import { AppShell } from "@/components/app-shell";
import { StatusPill } from "@/components/status-pill";
import { recentItems } from "@/lib/mock-data";
import { Banknote, CheckCircle2, Download, Settings2, ShoppingCart } from "lucide-react";

export default function AdminPage() {
  return (
    <AppShell title="Admin control panel" eyebrow="Review, approve, purchase">
      <div className="grid gap-5 xl:grid-cols-3">
        {[
          ["Payment approvals", "9 pending proofs", Banknote],
          ["Purchase queue", "31 ready for extension", ShoppingCart],
          ["Rate settings", "CNY to BDT: 16.2", Settings2]
        ].map(([title, detail, Icon]) => (
          <article key={String(title)} className="rounded-lg border border-line bg-white p-5 shadow-panel">
            <Icon className="text-jade" />
            <h3 className="mt-4 text-lg font-semibold">{String(title)}</h3>
            <p className="mt-2 text-sm text-ink/60">{String(detail)}</p>
          </article>
        ))}
      </div>

      <section className="mt-5 rounded-lg border border-line bg-white p-5 shadow-panel">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h3 className="text-xl font-semibold">Order approval queue</h3>
          <button className="inline-flex items-center gap-2 rounded-md border border-line px-4 py-2 text-sm font-semibold">
            <Download size={16} /> Export Excel
          </button>
        </div>
        <div className="mt-4 grid gap-3">
          {recentItems.map((item) => (
            <div key={item.id} className="grid gap-3 rounded-md border border-line p-4 md:grid-cols-[1fr_auto_auto] md:items-center">
              <div>
                <p className="font-semibold">{item.product}</p>
                <p className="text-sm text-ink/60">{item.client} · {item.group}</p>
              </div>
              <StatusPill status={item.status} />
              <button className="inline-flex items-center justify-center gap-2 rounded-md bg-jade px-4 py-2 text-sm font-semibold text-white">
                <CheckCircle2 size={16} /> Approve
              </button>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
