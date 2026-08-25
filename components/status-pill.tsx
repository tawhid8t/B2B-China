const styles: Record<string, string> = {
  pending_admin_review: "bg-saffron/15 text-[#81570f]",
  queued_for_purchase: "bg-jade/15 text-jade",
  seller_shipped: "bg-blue-100 text-blue-800",
  received_china: "bg-emerald-100 text-emerald-800",
  packed: "bg-stone-200 text-stone-800",
  qc_checked: "bg-purple-100 text-purple-800"
};

export function StatusPill({ status }: { status: string }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status] ?? "bg-stone-100 text-stone-700"}`}>{status.replaceAll("_", " ")}</span>;
}
