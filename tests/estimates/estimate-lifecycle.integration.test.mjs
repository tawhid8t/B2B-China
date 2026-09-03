import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  EstimateLifecycleError,
  acceptEstimate,
  rejectEstimate,
} from "../../services/estimate-lifecycle-service.ts";

const ESTIMATE_ID = "a1000000-0000-0000-0000-000000000001";
const CLIENT_ID = "a2000000-0000-0000-0000-000000000002";

function createContext(rpc, role = "client") {
  return {
    role,
    user: { id: "a3000000-0000-0000-0000-000000000003" },
    supabase: { rpc },
  };
}

function acceptedRow() {
  return {
    order_item_id: "b1000000-0000-0000-0000-000000000001",
    group_id: "b2000000-0000-0000-0000-000000000002",
    group_code: "DTH-AUG-01",
    order_status: "pending_admin_review",
    wallet_reservation_status: "reserved_or_partial",
    reservation_transaction_id: "b3000000-0000-0000-0000-000000000003",
    required_amount_cny: "722.77",
    reserved_amount_cny: "500.00",
    uncovered_amount_cny: "222.77",
    wallet_balance_cny: "0.00",
  };
}

test("acceptance calls only the canonical transactional estimate RPC", async () => {
  const calls = [];
  const context = createContext(async (name, input) => {
    calls.push([name, input]);
    return { data: [acceptedRow()], error: null };
  });

  const result = await acceptEstimate(context, {
    estimateId: ESTIMATE_ID,
    clientId: CLIENT_ID,
  });

  assert.deepEqual(calls, [["accept_estimate", {
    p_estimate_id: ESTIMATE_ID,
    p_client_id: CLIENT_ID,
  }]]);
  assert.deepEqual(result, {
    orderItemId: "b1000000-0000-0000-0000-000000000001",
    groupId: "b2000000-0000-0000-0000-000000000002",
    groupCode: "DTH-AUG-01",
    status: "pending_admin_review",
    walletReservationStatus: "reserved_or_partial",
    reservationTransactionId: "b3000000-0000-0000-0000-000000000003",
    requiredAmountCny: 722.77,
    reservedAmountCny: 500,
    uncoveredAmountCny: 222.77,
    walletBalanceCny: 0,
  });
});

test("duplicate acceptance returns the original order without a second conversion", async () => {
  const row = acceptedRow();
  let createdOrders = 0;
  let persistedOrder = null;
  const context = createContext(async (name) => {
    assert.equal(name, "accept_estimate");
    if (!persistedOrder) {
      persistedOrder = row;
      createdOrders += 1;
    }
    return { data: [persistedOrder], error: null };
  });

  const first = await acceptEstimate(context, {
    estimateId: ESTIMATE_ID,
    clientId: CLIENT_ID,
  });
  const duplicate = await acceptEstimate(context, {
    estimateId: ESTIMATE_ID,
    clientId: CLIENT_ID,
  });

  assert.equal(createdOrders, 1);
  assert.equal(duplicate.orderItemId, first.orderItemId);
  assert.equal(duplicate.groupId, first.groupId);
});

test("expired estimate acceptance maps to the documented error", async () => {
  const context = createContext(async () => ({
    data: null,
    error: { code: "P0001", message: "estimate has expired" },
  }));

  await assert.rejects(
    () => acceptEstimate(context, {
      estimateId: ESTIMATE_ID,
      clientId: CLIENT_ID,
    }),
    (error) =>
      error instanceof EstimateLifecycleError &&
      error.code === "EXPIRED_ESTIMATE" &&
      error.status === 409,
  );
});

test("invalid lifecycle acceptance maps to conflict", async () => {
  const context = createContext(async () => ({
    data: null,
    error: {
      code: "23514",
      message: "estimate is not available for acceptance",
    },
  }));

  await assert.rejects(
    () => acceptEstimate(context, {
      estimateId: ESTIMATE_ID,
      clientId: CLIENT_ID,
    }),
    (error) =>
      error instanceof EstimateLifecycleError &&
      error.code === "CONFLICT" &&
      error.status === 409,
  );
});

test("rejection passes the audited reason and is idempotent", async () => {
  const calls = [];
  let status = "sent_to_client";
  let auditWrites = 0;
  const context = createContext(async (name, input) => {
    calls.push([name, input]);
    if (status !== "rejected") {
      status = "rejected";
      auditWrites += 1;
    }
    return {
      data: [{ estimate_id: ESTIMATE_ID, estimate_status: status }],
      error: null,
    };
  });

  const first = await rejectEstimate(context, {
    estimateId: ESTIMATE_ID,
    reason: "Too expensive",
  });
  const duplicate = await rejectEstimate(context, {
    estimateId: ESTIMATE_ID,
    reason: "Too expensive",
  });

  assert.equal(first.status, "rejected");
  assert.deepEqual(duplicate, first);
  assert.equal(auditWrites, 1);
  assert.deepEqual(calls[0], ["reject_estimate", {
    p_estimate_id: ESTIMATE_ID,
    p_reason: "Too expensive",
  }]);
});

test("service rejects non-client operational roles before database access", async () => {
  let called = false;
  const context = createContext(async () => {
    called = true;
    return { data: null, error: null };
  }, "staff_receiver");

  await assert.rejects(
    () => rejectEstimate(context, {
      estimateId: ESTIMATE_ID,
      reason: "No longer needed",
    }),
    (error) =>
      error instanceof EstimateLifecycleError && error.code === "FORBIDDEN",
  );
  assert.equal(called, false);
});

test("canonical routes use authenticated API envelopes and lifecycle service", async () => {
  const [acceptSource, rejectSource] = await Promise.all([
    readFile("app/api/estimates/[id]/accept/route.ts", "utf8"),
    readFile("app/api/estimates/[id]/reject/route.ts", "utf8"),
  ]);

  for (const source of [acceptSource, rejectSource]) {
    assert.match(source, /authorizeApiRequest/);
    assert.match(source, /apiSuccess/);
    assert.match(source, /apiError/);
    assert.match(source, /EstimateLifecycleError/);
    assert.doesNotMatch(source, /createSupabaseAdminClient|SUPABASE_SERVICE_ROLE_KEY/);
  }
  assert.doesNotMatch(acceptSource, /order-wallet-service/);
});

test("database lifecycle commands enforce locking, expiry, auditing, and exactly-once conversion", async () => {
  const [walletMigration, lifecycleMigration, schemaMigration] = await Promise.all([
    readFile(
      "supabase/migrations/20260825185926_implement_oc001_wallet_reservations.sql",
      "utf8",
    ),
    readFile(
      "supabase/migrations/20260826144747_canonical_estimate_lifecycle.sql",
      "utf8",
    ),
    readFile(
      "supabase/migrations/20260825162319_align_core_schema.sql",
      "utf8",
    ),
  ]);

  const acceptanceStart = walletMigration.indexOf(
    "create or replace function private.accept_estimate_with_reservation_internal",
  );
  const acceptanceEnd = walletMigration.indexOf(
    "revoke all on function private.accept_estimate_with_reservation_internal",
  );
  const acceptance = walletMigration.slice(acceptanceStart, acceptanceEnd);

  assert.match(acceptance, /for update/);
  assert.match(acceptance, /status = 'accepted'/);
  assert.match(acceptance, /status = 'converted_to_order'/);
  assert.match(acceptance, /valid_until <= now\(\)/);
  assert.match(acceptance, /status = 'converted_to_order'[\s\S]*order_items/);
  assert.doesNotMatch(acceptance, /'order_debit'/);
  assert.match(
    schemaMigration,
    /create unique index order_items_estimate_id_key[\s\S]*estimate_id/,
  );

  assert.match(lifecycleMigration, /create or replace function public\.accept_estimate/);
  assert.match(lifecycleMigration, /create or replace function private\.reject_estimate_internal/);
  assert.match(lifecycleMigration, /from public\.estimates e[\s\S]*for update/);
  assert.match(lifecycleMigration, /estimate_rejected/);
  assert.match(lifecycleMigration, /estimates_acceptance_transition_audit/);
});
