import { ClientProductStatement, type StatementResponse } from "@/components/client/client-product-statement";
import { ClientShell } from "@/components/client/client-shell";

const fixtureData: StatementResponse = {
  data: [
    { product_link_id: "statement-product-1", product_code: "1688-TRAVEL-01", product_title: "Professional waterproof travel organizer with reinforced compartments", product_images: [], category: "Travel accessories", total_quantity: 84, product_amount_cny: 1579.2, local_delivery_cny: 24, total_weight_kg: 9.4, guangzhou_cost_cny: 37.6, bangladesh_shipping_bdt: 7050, service_charge_cny: 94.75, total_bdt: 40216.59, average_unit_cost_bdt: 478.77, status: "arrived_guangzhou", mixed_progress: true, cost_state: "partial", note: "Some submitted SKUs are already at the Guangzhou hub." },
    { product_link_id: "statement-product-2", product_code: "1688-HOME-04", product_title: "Foldable household storage box, large capacity", product_images: [], category: "Home goods", total_quantity: 30, product_amount_cny: 690, local_delivery_cny: 12, total_weight_kg: null, guangzhou_cost_cny: null, bangladesh_shipping_bdt: null, service_charge_cny: 41.4, total_bdt: 14139.0, average_unit_cost_bdt: 471.3, status: "pending_admin_review", mixed_progress: false, cost_state: "estimated", note: "Final shipping values are unavailable until weight review." },
  ],
  meta: {
    page: 1, pageSize: 30, total: 2,
    chart: { orderedProducts: 2, totalQuantity: 114, totalWeightKg: 9.4, totalBdt: 54355.59, categories: [{ category: "Travel accessories", ordered_products: 1, total_quantity: 84, total_weight_kg: 9.4 }, { category: "Home goods", ordered_products: 1, total_quantity: 30, total_weight_kg: null }] },
  },
};

export function ClientProductStatementFixture() {
  return <ClientShell user={{ name: "Amina", email: "amina@example.com" }} unreadNotificationCount={3} visualPathname="/client/excel-details"><ClientProductStatement fixtureData={fixtureData} /></ClientShell>;
}
