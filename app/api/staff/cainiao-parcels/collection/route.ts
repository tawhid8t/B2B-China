import { apiSuccess } from "@/lib/api/response";
import { databaseErrorResponse } from "@/lib/api/database-error";
import { authorizeApiRequest } from "@/lib/auth/api";
import { RECEIVING_ROLES } from "@/lib/auth/roles";

type QueueRow = {
  parcel_id: string;
  tracking_number: string;
  parcel_status: "delivered" | "in_transit" | "received" | "exception" | string;
  source_status: string | null;
  pickup_code: string | null;
  carrier: string | null;
  pickup_station: string | null;
  source_arrived_at: string | null;
  source_expected_arrival_at: string | null;
  source_last_tracking_update_at: string | null;
  collected_at: string | null;
  unmatched_review_status: "open" | "linked" | "archived";
  order_item_id: string | null;
  client_business_name: string | null;
  product_title: string | null;
  product_images: string[] | null;
  sku_label: string | null;
  expected_order_quantity: number | null;
  expected_pieces: number | null;
};

export async function GET(request: Request) {
  const authorization = await authorizeApiRequest(request, RECEIVING_ROLES);
  if (!authorization.authorized) return authorization.response;

  const { data, error } = await authorization.context.supabase.rpc("get_cainiao_collection_queue");
  if (error) return databaseErrorResponse(error, "INTERNAL_ERROR", "Cainiao collection queue could not be loaded.");

  const rows = (data ?? []) as QueueRow[];
  const parcels = groupParcels(rows);
  const today = chinaDateKey(new Date());
  const summary = {
    readyToCollect: parcels.filter((parcel) => parcel.status === "delivered" && !parcel.collectedAt).length,
    arrivingSoon: parcels.filter((parcel) => parcel.status === "in_transit" && /arriv|到站|即将/.test(parcel.sourceStatus ?? "")).length,
    inTransit: parcels.filter((parcel) => parcel.status === "in_transit" && !/arriv|到站|即将/.test(parcel.sourceStatus ?? "")).length,
    collectedToday: parcels.filter((parcel) => parcel.collectedAt && chinaDateKey(new Date(parcel.collectedAt)) === today).length,
    unmatched: parcels.filter((parcel) => parcel.unmatched && parcel.status !== "received").length,
  };

  return apiSuccess({ summary, parcels });
}

function groupParcels(rows: QueueRow[]) {
  const byParcel = new Map<string, ReturnType<typeof createParcel>>();
  const relatedParcelsByOrderItem = new Map<string, Set<string>>();

  for (const row of rows) {
    if (row.order_item_id) {
      const related = relatedParcelsByOrderItem.get(row.order_item_id) ?? new Set<string>();
      related.add(row.parcel_id);
      relatedParcelsByOrderItem.set(row.order_item_id, related);
    }
    const current = byParcel.get(row.parcel_id) ?? createParcel(row);
    if (!byParcel.has(row.parcel_id)) byParcel.set(row.parcel_id, current);
    if (row.order_item_id && !current.items.some((item) => item.orderItemId === row.order_item_id)) {
      current.items.push({
        orderItemId: row.order_item_id,
        productTitle: row.product_title,
        productImage: row.product_images?.[0] ?? null,
        skuLabel: row.sku_label,
        clientBusinessName: row.client_business_name,
        expectedOrderQuantity: row.expected_order_quantity,
        expectedPieces: row.expected_pieces,
      });
    }
  }

  return [...byParcel.values()].map((parcel) => ({
    ...parcel,
    relatedParcelCount: Math.max(
      1,
      ...parcel.items.map((item) => relatedParcelsByOrderItem.get(item.orderItemId)?.size ?? 1),
    ),
  }));
}

function createParcel(row: QueueRow) {
  return {
    id: row.parcel_id,
    trackingNumber: row.tracking_number,
    status: row.parcel_status,
    sourceStatus: row.source_status,
    pickupCode: row.pickup_code,
    carrier: row.carrier,
    pickupStation: row.pickup_station,
    arrivedAt: row.source_arrived_at,
    expectedArrivalAt: row.source_expected_arrival_at,
    lastTrackingUpdateAt: row.source_last_tracking_update_at,
    collectedAt: row.collected_at,
    unmatched: row.unmatched_review_status === "open",
    items: [] as Array<{
      orderItemId: string;
      productTitle: string | null;
      productImage: string | null;
      skuLabel: string | null;
      clientBusinessName: string | null;
      expectedOrderQuantity: number | null;
      expectedPieces: number | null;
    }>,
  };
}

function chinaDateKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}
