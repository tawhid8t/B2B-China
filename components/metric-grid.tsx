import { DashboardMetric } from "@/lib/types";

export function MetricGrid({ metrics }: { metrics: DashboardMetric[] }) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <article key={metric.label} className="rounded-lg border border-line bg-white p-5 shadow-panel">
          <p className="text-sm text-ink/60">{metric.label}</p>
          <strong className="mt-2 block text-3xl text-ink">{metric.value}</strong>
          <p className="mt-2 text-sm text-ink/60">{metric.detail}</p>
        </article>
      ))}
    </section>
  );
}
