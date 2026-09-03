import { apiError, apiSuccess } from "@/lib/api/response";
import { authorizeExtensionApiRequest } from "@/lib/auth/extension-api";
import { extensionCorsPreflight, extensionCorsResponse } from "@/lib/api/extension-cors";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type PurchaseQueueRow = {
  purchase_task_id: string;
  product_order_id: string;
  order_item_id: string;
  purchase_batch_id: string;
  order_number: string;
  provider: string;
  product_url: string;
  provider_item_id: string;
  product_title: string;
  task_state: "queued" | "needs_review";
  can_prepare: boolean;
  block_reason: string | null;
  provider_sku_id: string | null;
  sku_label: string;
  attributes: Record<string, unknown>;
  quantity: number;
  expected_unit_price_cny: number | string;
  expected_domestic_delivery_cny: number | string | null;
  product_image: string | null;
};

export async function GET(request: Request) {
  const authorization = await authorizeExtensionApiRequest(request);
  if (!authorization.authorized) return extensionCorsResponse(request, authorization.response);

  const rpc = authorization.kind === "credential"
    ? "get_extension_purchase_queue_v2_for_credential"
    : "get_extension_purchase_queue_v2";

  try {
    const client = authorization.kind === "credential" ? createSupabaseAdminClient() : authorization.context.supabase;
    const args = authorization.kind === "credential" ? { p_profile_id: authorization.context.profileId } : undefined;
    const { data, error } = await client.rpc(rpc, args);

    if (error) {
      console.error("Extension purchase queue RPC failed", {
        rpc,
        authKind: authorization.kind,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      return extensionCorsResponse(request, apiError("INTERNAL_ERROR", "Purchase queue could not be loaded.", 500));
    }

    const grouped = new Map<string, Record<string, unknown>>();
    for (const item of (data ?? []) as PurchaseQueueRow[]) {
      const sku = {
        orderItemId: item.order_item_id,
        providerSkuId: item.provider_sku_id,
        skuLabel: item.sku_label,
        attributes: item.attributes,
        quantity: item.quantity,
        expectedUnitPriceCny: Number(item.expected_unit_price_cny),
        expectedDomesticDeliveryCny: item.expected_domestic_delivery_cny === null ? null : Number(item.expected_domestic_delivery_cny),
      };
      const existing = grouped.get(item.purchase_task_id);
      if (existing) {
        (existing.skus as typeof sku[]).push(sku);
        continue;
      }
      // Legacy fields deliberately mirror the first SKU during the v1/v2 transition.
      grouped.set(item.purchase_task_id, {
        schemaVersion: 2,
        purchaseTaskId: item.purchase_task_id,
        productOrderId: item.product_order_id,
        purchaseBatchId: item.purchase_batch_id,
        orderNumber: item.order_number,
        provider: item.provider,
        productUrl: item.product_url,
        providerItemId: item.provider_item_id,
        productTitle: item.product_title,
        productImage: item.product_image ?? null,
        taskState: item.task_state,
        canPrepare: item.can_prepare,
        blockReason: item.block_reason,
        skus: [sku],
        ...sku,
      });
    }
    return extensionCorsResponse(request, apiSuccess([...grouped.values()]));
  } catch (error) {
    console.error("Extension purchase queue request failed", {
      rpc,
      authKind: authorization.kind,
      message: error instanceof Error ? error.message : "Unknown server error",
    });
    return extensionCorsResponse(request, apiError("INTERNAL_ERROR", "Purchase queue could not be loaded.", 500));
  }
}

export function OPTIONS(request: Request) { return extensionCorsPreflight(request); }
