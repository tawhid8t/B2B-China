import { ArrowLeft, Boxes, Check } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

const benefits = [
  "Start with supplier links from 1688, Taobao, or Tmall.",
  "Review product details and estimate inputs before deciding.",
  "Keep the China-to-Bangladesh handoffs clear as work progresses."
];

export function AuthShell({ title, description, children, footer }: { title: string; description: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="auth-theme min-h-[100dvh] overflow-x-hidden bg-canvas text-foreground">
      <header className="safe-area-top border-b border-border bg-surface lg:hidden">
        <div className="content-shell flex min-h-14 items-center justify-between gap-3">
          <Brand />
          <Link href="/" className="focus-ring inline-flex min-h-touch shrink-0 items-center gap-1.5 rounded-control px-2 text-sm font-semibold text-muted hover:bg-surface-muted hover:text-foreground"><ArrowLeft aria-hidden="true" className="h-4 w-4" />Home</Link>
        </div>
      </header>
      <div className="content-shell grid min-h-[calc(100dvh-3.5rem)] gap-8 py-6 sm:gap-10 sm:py-10 lg:min-h-[100dvh] lg:grid-cols-[minmax(0,1fr)_minmax(22rem,30rem)] lg:items-center lg:gap-20 lg:py-16">
        <section className="relative hidden min-h-[34rem] overflow-hidden rounded-panel bg-action-primary p-8 text-on-action shadow-panel lg:flex lg:flex-col lg:justify-between lg:p-10" aria-label="BridgeCart benefits">
          <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full border border-white/10" aria-hidden="true" />
          <div className="relative"><Brand dark /><p className="mt-10 max-w-lg text-4xl font-semibold leading-tight tracking-[-0.035em]">A clearer way to source across borders.</p><p className="mt-4 max-w-md text-base leading-7 text-on-action/70">BridgeCart brings your supplier link, product review, estimate, and operational handoffs into one focused workspace.</p></div>
          <ul className="relative space-y-4 text-sm leading-6 text-on-action/80">{benefits.map((benefit) => <li key={benefit} className="flex gap-3"><span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent-mint text-action-primary"><Check aria-hidden="true" className="h-3 w-3" /></span><span>{benefit}</span></li>)}</ul>
        </section>
        <section className="flex items-center justify-center">
          <Card className="w-full max-w-form rounded-panel shadow-none sm:shadow-panel">
            <div className="p-5 sm:p-7">
              <div className="mb-6 lg:hidden"><p className="text-xs font-bold uppercase tracking-[0.12em] text-action-primary">BridgeCart account</p></div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
              <p className="mt-2 text-sm leading-6 text-muted sm:text-base">{description}</p>
              <div className="mt-7">{children}</div>
            </div>
            {footer && <div className="border-t border-border bg-surface-muted/60 px-5 py-4 text-center text-sm text-muted sm:px-7">{footer}</div>}
          </Card>
        </section>
      </div>
    </main>
  );
}

function Brand({ dark = false }: { dark?: boolean }) {
  return <Link href="/" className="focus-ring inline-flex min-w-0 items-center gap-2.5 rounded-control" aria-label="BridgeCart home"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-control ${dark ? "bg-accent-mint text-action-primary" : "bg-action-primary text-on-action"}`}><Boxes aria-hidden="true" className="h-5 w-5" /></span><span className="min-w-0"><span className={`block truncate text-[0.65rem] font-semibold uppercase tracking-[0.12em] ${dark ? "text-on-action/60" : "text-muted"}`}>China to Bangladesh</span><span className={`block truncate text-lg font-bold leading-tight tracking-tight ${dark ? "text-on-action" : "text-foreground"}`}>BridgeCart</span></span></Link>;
}
