import { AppShell } from "@/components/app-shell";
import { MetricGrid } from "@/components/metric-grid";
import { StatusPill } from "@/components/status-pill";
import { metrics, orderPipeline, recentItems } from "@/lib/mock-data";
import { ArrowRight, Calculator, PackageSearch, ShieldCheck, Truck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function HomePage() {
  return (
    <AppShell title="Cross-border sourcing command center" eyebrow="Operations MVP">
      <div className="space-y-6">
        <section className="grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
          <div className="rounded-lg border border-line bg-white p-6 shadow-panel">
            <div className="max-w-3xl">
              <h3 className="text-2xl font-semibold">From client link to Bangladesh warehouse, every handoff is tracked.</h3>
              <p className="mt-3 text-ink/70">
                This starter implements the product architecture as working screens, API contracts, pricing logic, Supabase schema, and extension scaffolding for the first operations release.
              </p>
            </div>
            <div className="mt-6 grid gap-3 md:grid-cols-4">
              {[
                ["Link fetch", PackageSearch],
                ["Estimate", Calculator],
                ["QC & cartons", ShieldCheck],
                ["Guangzhou", Truck]
              ].map(([label, Icon]) => (
                <div key={String(label)} className="rounded-md border border-line bg-paper p-4">
                  <Icon className="text-jade" size={22} />
                  <p className="mt-3 text-sm font-semibold">{String(label)}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-line bg-ink p-6 text-white shadow-panel">
            <p className="text-sm text-white/60">Next priority</p>
            <h3 className="mt-2 text-2xl font-semibold">Connect Supabase keys and OTAPI credentials</h3>
            <p className="mt-3 text-sm text-white/70">Without credentials the app uses deterministic mock product data so flows can be tested locally.</p>
            <Link href="/client" className="mt-6 inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-semibold text-ink">
              Try client flow <ArrowRight size={16} />
            </Link>
          </div>
        </section>

        <MetricGrid metrics={metrics} />

        <section className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-lg border border-line bg-white p-5 shadow-panel">
            <h3 className="text-lg font-semibold">Order pipeline</h3>
            <div className="mt-4 space-y-3">
              {orderPipeline.map((step) => (
                <div key={step.status} className="flex items-center justify-between rounded-md bg-paper px-4 py-3">
                  <span className="text-sm font-medium">{step.label}</span>
                  <span className="text-lg font-semibold">{step.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-line bg-white p-5 shadow-panel">
            <h3 className="text-lg font-semibold">Recent operating items</h3>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[650px] text-left text-sm">
                <thead className="text-ink/55">
                  <tr>
                    <th className="py-2">Product</th>
                    <th>Client</th>
                    <th>Group</th>
                    <th>Estimate</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {recentItems.map((item) => (
                    <tr key={item.id}>
                      <td className="py-3">
                        <div className="flex items-center gap-3">
                          <Image src={item.image} alt="" width={42} height={42} className="rounded-md border border-line" />
                          <div>
                            <p className="font-medium">{item.product}</p>
                            <p className="text-xs text-ink/50">{item.id}</p>
                          </div>
                        </div>
                      </td>
                      <td>{item.client}</td>
                      <td>{item.group}</td>
                      <td>{item.estimate}</td>
                      <td><StatusPill status={item.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
