import { ArrowRight, ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { PublicShell } from "@/components/public-site/public-shell";
import { Alert, Card } from "@/components/ui";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/ui/cn";

export function PublicContentPage({
  eyebrow,
  title,
  intro,
  children,
  cta = true
}: {
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
  cta?: boolean;
}) {
  return (
    <PublicShell>
      <main>
        <section className="border-b border-border bg-surface" aria-labelledby="public-page-title">
          <div className="content-shell py-14 sm:py-20 lg:py-24">
            <nav aria-label="Breadcrumb" className="mb-8 flex items-center gap-1.5 text-sm text-muted">
              <Link href="/" className="focus-ring rounded-control py-1 hover:text-foreground">Home</Link>
              <ChevronRight aria-hidden="true" className="h-4 w-4" />
              <span aria-current="page" className="font-medium text-foreground">{title}</span>
            </nav>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-vermilion-700">{eyebrow}</p>
            <h1 id="public-page-title" className="mt-3 max-w-3xl text-4xl font-semibold leading-tight tracking-[-0.035em] text-foreground sm:text-5xl">{title}</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted sm:text-lg sm:leading-8">{intro}</p>
          </div>
        </section>
        <div className="content-shell py-14 sm:py-20">
          <div className="max-w-4xl space-y-14 sm:space-y-20">{children}</div>
          {cta && <div className="mt-14 rounded-panel bg-commerce-950 px-5 py-8 text-white sm:mt-20 sm:px-8 sm:py-10"><p className="text-xs font-bold uppercase tracking-[0.12em] text-gold-300">Ready to start?</p><div className="mt-2 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Bring a supplier link into the workflow.</h2><p className="mt-2 max-w-xl text-sm leading-6 text-white/70">Create an account when you are ready to review a product and request an estimate.</p></div><Link href="/auth/register" className={buttonClasses({ variant: "primary", size: "lg", className: "bg-white text-commerce-900 hover:bg-commerce-50" })}>Create account <ArrowRight aria-hidden="true" className="h-4 w-4" /></Link></div></div>}
        </div>
      </main>
    </PublicShell>
  );
}

export function ContentSection({ eyebrow, title, children, className }: { eyebrow?: string; title: string; children: ReactNode; className?: string }) {
  return <section className={cn("space-y-5", className)} aria-labelledby={`${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-title`}><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-vermilion-700">{eyebrow}</p><h2 id={`${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-title`} className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h2></div>{children}</section>;
}

export function InfoCard({ icon: Icon, title, children, className }: { icon: LucideIcon; title: string; children: ReactNode; className?: string }) {
  return <Card className={cn("p-5 sm:p-6", className)}><span className="grid h-11 w-11 place-items-center rounded-control bg-commerce-100 text-commerce-700"><Icon aria-hidden="true" className="h-5 w-5" /></span><h3 className="mt-5 text-lg font-semibold">{title}</h3><div className="mt-2 text-sm leading-6 text-muted">{children}</div></Card>;
}

export function NumberedItem({ number, title, children }: { number: string; title: string; children: ReactNode }) {
  return <div className="flex gap-4"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-commerce-100 text-sm font-bold tabular-nums text-commerce-800">{number}</span><div><h3 className="font-semibold text-foreground">{title}</h3><div className="mt-1 text-sm leading-6 text-muted">{children}</div></div></div>;
}

export function PolicyNote({ title, children, variant = "info" }: { title: string; children: ReactNode; variant?: "info" | "warning" }) {
  return <Alert variant={variant} title={title}>{children}</Alert>;
}

export function LinkList({ items }: { items: Array<{ label: string; href: string; description: string }> }) {
  return <div className="grid gap-3 sm:grid-cols-2">{items.map((item) => <Link key={item.href} href={item.href} className="focus-ring rounded-card border border-border bg-surface p-4 transition-colors duration-fast hover:border-commerce-300 hover:bg-surface-muted"><span className="flex items-center justify-between gap-3"><span className="font-semibold text-foreground">{item.label}</span><ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-commerce-700" /></span><span className="mt-1 block text-sm leading-6 text-muted">{item.description}</span></Link>)}</div>;
}
