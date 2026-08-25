import { AppShell } from "@/components/app-shell";
import { Chrome, ClipboardCheck, MousePointerClick, ShieldAlert } from "lucide-react";

export default function ExtensionPage() {
  return (
    <AppShell title="Chrome extension bridge" eyebrow="1688/Taobao assisted purchase">
      <section className="grid gap-5 xl:grid-cols-3">
        {[
          ["Fetch queue", "Approved items become extension tasks.", ClipboardCheck],
          ["Fill cart", "SKU, color, size, and quantity are copied to provider cart.", MousePointerClick],
          ["Sync payment", "Admin pays manually; extension posts order and tracking data.", Chrome]
        ].map(([title, detail, Icon]) => (
          <article key={String(title)} className="rounded-lg border border-line bg-white p-5 shadow-panel">
            <Icon className="text-jade" />
            <h3 className="mt-4 text-lg font-semibold">{String(title)}</h3>
            <p className="mt-2 text-sm text-ink/60">{String(detail)}</p>
          </article>
        ))}
      </section>
      <div className="mt-5 rounded-lg border border-coral/30 bg-coral/10 p-5">
        <div className="flex gap-3">
          <ShieldAlert className="shrink-0 text-coral" />
          <p className="text-sm text-ink/75">
            The extension is designed as an admin-only helper. It should not store provider passwords, and every captured paid amount or tracking number must be auditable in Supabase.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
