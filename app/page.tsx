import {
  ArrowRight,
  BadgeCheck,
  Boxes,
  Calculator,
  Check,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  Globe2,
  Link2,
  PackageCheck,
  PackageSearch,
  ScanSearch,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Store,
  Truck,
  Warehouse
} from "lucide-react";
import Link from "next/link";
import { PublicShell } from "@/components/public-site/public-shell";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const steps = [
  { title: "Paste link", text: "Start with a supplier link from 1688, Taobao, or Tmall.", icon: Link2 },
  { title: "Select product", text: "Review the returned product details, variant, and quantity.", icon: ScanSearch },
  { title: "Review estimate", text: "See the costs that make up your estimate in BDT.", icon: Calculator },
  { title: "We purchase", text: "Your accepted request moves to the purchasing workflow.", icon: ShoppingCart },
  { title: "QC and repack", text: "China-side receiving, quality checks, and repacking follow.", icon: PackageCheck },
  { title: "Bangladesh delivery", text: "Follow the journey as the shipment moves toward Bangladesh.", icon: Truck }
];

const benefits = [
  { title: "One clear starting point", text: "Bring a supplier link into one place instead of coordinating the first handoff across messages and spreadsheets.", icon: Boxes },
  { title: "An estimate you can inspect", text: "See product, domestic delivery, exchange, weight, shipping, and other estimate inputs before you decide.", icon: ClipboardCheck },
  { title: "China-side operations in view", text: "The workflow is designed around purchasing, receiving, QC, repacking, and forwarding handoffs.", icon: Warehouse }
];

const trackingStages = [
  { label: "Request", icon: Link2 },
  { label: "Review", icon: ClipboardCheck },
  { label: "Purchase", icon: ShoppingCart },
  { label: "China QC", icon: ShieldCheck },
  { label: "Forward", icon: Truck },
  { label: "Bangladesh", icon: Globe2 }
];

export default function HomePage() {
  return (
    <PublicShell>
      <main>
        <section className="relative overflow-hidden border-b border-border bg-surface" aria-labelledby="hero-title">
          <div className="content-shell grid gap-10 pb-16 pt-12 sm:pb-20 sm:pt-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-16 lg:pb-24 lg:pt-24">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-commerce-100 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-commerce-800"><Sparkles aria-hidden="true" className="h-3.5 w-3.5" />China to Bangladesh sourcing</div>
              <h1 id="hero-title" className="mt-5 text-[2.65rem] font-semibold leading-[1.08] tracking-[-0.04em] text-foreground sm:text-5xl lg:text-6xl">Source from China with a clearer path to Bangladesh.</h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-muted sm:text-lg sm:leading-8">Paste supplier links, review product details and estimates, and keep the sourcing handoffs in one organized platform.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row"><Link href="/auth/register" className={buttonClasses({ variant: "primary", size: "lg" })}>Create account <ArrowRight aria-hidden="true" className="h-4 w-4" /></Link><a href="#how-it-works" className={buttonClasses({ variant: "outline", size: "lg" })}>How it works</a></div>
              <p className="mt-4 flex items-center gap-2 text-xs font-medium text-muted"><BadgeCheck aria-hidden="true" className="h-4 w-4 text-commerce-600" />Built for Bangladesh businesses buying from 1688, Taobao, and Tmall.</p>
            </div>
            <div className="relative mx-auto w-full max-w-md lg:max-w-none" aria-label="Illustrative sourcing workflow">
              <div className="absolute -left-8 top-12 hidden h-40 w-40 rounded-full border border-vermilion-200 sm:block" aria-hidden="true" />
              <Card className="relative overflow-hidden border-commerce-200 bg-surface shadow-panel">
                <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6"><div><p className="text-xs font-bold uppercase tracking-[0.1em] text-commerce-700">A clearer handoff</p><p className="mt-1 text-sm font-semibold text-foreground">From supplier link to estimate</p></div><span className="grid h-9 w-9 place-items-center rounded-full bg-vermilion-100 text-vermilion-700"><Link2 aria-hidden="true" className="h-4 w-4" /></span></div>
                <div className="p-5 sm:p-6"><label htmlFor="hero-link-demo" className="text-xs font-semibold text-muted">Supplier product link</label><div className="mt-2 flex min-h-touch-lg items-center gap-2 rounded-control border border-border bg-surface-muted px-3.5 text-sm text-muted"><Link2 aria-hidden="true" className="h-4 w-4 shrink-0 text-commerce-600" /><input id="hero-link-demo" readOnly value="detail.1688.com/offer/..." aria-describedby="hero-link-note" className="min-w-0 flex-1 truncate border-0 bg-transparent p-0 text-sm text-foreground outline-none" /></div><p id="hero-link-note" className="mt-2 text-xs leading-5 text-muted">Illustrative only — this homepage does not submit or save a product request.</p><div className="mt-6 space-y-4"><DemoRow icon={PackageSearch} label="Product details" detail="Returned for review" /><DemoRow icon={Calculator} label="Estimate" detail="Costs shown in BDT" /><DemoRow icon={Truck} label="Operations" detail="Handoffs kept visible" last /></div></div>
              </Card>
            </div>
          </div>
        </section>

        <section id="services" className="content-shell scroll-mt-20 py-16 sm:py-20" aria-labelledby="marketplaces-title"><div className="max-w-reading"><p className="text-xs font-bold uppercase tracking-[0.12em] text-vermilion-700">Start with the marketplace you already use</p><h2 id="marketplaces-title" className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Bring your China supplier link. We organize the next steps.</h2><p className="mt-3 text-base leading-7 text-muted">The first step is simple: use a supported marketplace link, then review the product and estimate before moving forward.</p></div><div className="mt-8 grid gap-4 sm:grid-cols-3"><MarketplaceCard name="1688" detail="Wholesale marketplace" icon={Store} /><MarketplaceCard name="Taobao" detail="Retail marketplace" icon={ShoppingCart} /><MarketplaceCard name="Tmall" detail="Branded marketplace" icon={BadgeCheck} /></div></section>

        <section id="how-it-works" className="scroll-mt-20 border-y border-border bg-surface" aria-labelledby="steps-title"><div className="content-shell py-16 sm:py-20"><div className="max-w-reading"><p className="text-xs font-bold uppercase tracking-[0.12em] text-vermilion-700">How it works</p><h2 id="steps-title" className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">A practical flow from link to delivery.</h2><p className="mt-3 text-base leading-7 text-muted">Each stage gives you a clearer handoff between Bangladesh-side decisions and China-side operations.</p></div><div className="relative mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{steps.map((step, index) => <StepCard key={step.title} {...step} index={index + 1} />)}</div></div></section>

        <section className="content-shell py-16 sm:py-20" aria-labelledby="benefits-title"><div className="max-w-reading"><p className="text-xs font-bold uppercase tracking-[0.12em] text-vermilion-700">Why use the platform</p><h2 id="benefits-title" className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Less uncertainty at the moments that matter.</h2></div><div className="mt-8 grid gap-4 lg:grid-cols-3">{benefits.map(({ title, text, icon: Icon }) => <Card key={title} className="p-5 sm:p-6"><span className="grid h-11 w-11 place-items-center rounded-control bg-commerce-100 text-commerce-700"><Icon aria-hidden="true" className="h-5 w-5" /></span><h3 className="mt-5 text-lg font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-muted">{text}</p></Card>)}</div></section>

        <section id="shipping" className="scroll-mt-20 bg-commerce-950 text-white" aria-labelledby="estimate-title"><div className="content-shell grid gap-10 py-16 sm:py-20 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:gap-20"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-gold-300">Transparent estimates</p><h2 id="estimate-title" className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Know what the estimate is made of.</h2><p className="mt-4 max-w-xl text-base leading-7 text-white/70">The estimate is calculated from the product selection and operational inputs available at the time. It is a clear planning number, not a promise that final supplier, weight, or courier costs cannot change.</p><Link href="/auth/register" className="focus-ring mt-7 inline-flex min-h-touch-lg items-center justify-center gap-2 rounded-control bg-white px-5 py-3 text-sm font-semibold text-commerce-900 transition-colors hover:bg-commerce-50">Start with a link <ArrowRight aria-hidden="true" className="h-4 w-4" /></Link></div><Card className="border-white/10 bg-white/[0.08] p-5 text-white shadow-none sm:p-6"><p className="text-sm font-semibold text-white">Estimate context</p><div className="mt-5 grid gap-3 sm:grid-cols-2">{[["Product subtotal", "CNY supplier price × quantity"], ["China delivery", "Seller-to-China address"], ["Exchange rate", "Rate captured with estimate"], ["Estimated weight", "Used for shipping planning"], ["Category shipping", "Category-based estimate"], ["China to Guangzhou", "Domestic forwarding estimate"]].map(([label, detail]) => <div key={label} className="rounded-control border border-white/10 bg-white/[0.06] p-3.5"><p className="text-sm font-semibold text-white">{label}</p><p className="mt-1 text-xs leading-5 text-white/60">{detail}</p></div>)}</div><div className="mt-5 flex items-start gap-2 border-t border-white/10 pt-4 text-xs leading-5 text-white/60"><Clock3 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-gold-300" />Review the validity period and estimate note before accepting.</div></Card></div></section>

        <section className="content-shell py-16 sm:py-20" aria-labelledby="tracking-title"><div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-end"><div className="max-w-reading"><p className="text-xs font-bold uppercase tracking-[0.12em] text-vermilion-700">A visible journey</p><h2 id="tracking-title" className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">See the handoffs that happen after you order.</h2><p className="mt-3 text-base leading-7 text-muted">The platform is structured around the operational path, from purchasing in China through receiving, quality checks, repacking, and forwarding.</p></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{trackingStages.map(({ label, icon: Icon }, index) => <div key={label} className="relative rounded-card border border-border bg-surface p-4"><div className="flex items-center justify-between gap-2"><span className="grid h-9 w-9 place-items-center rounded-full bg-commerce-100 text-commerce-700"><Icon aria-hidden="true" className="h-4 w-4" /></span><span className="text-xs font-bold tabular-nums text-muted">0{index + 1}</span></div><p className="mt-4 text-sm font-semibold">{label}</p></div>)}</div></div></section>

        <section id="product-rules" className="scroll-mt-20 border-y border-border bg-surface" aria-labelledby="trust-title"><div className="content-shell grid gap-10 py-16 sm:py-20 lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-20"><div className="max-w-reading"><p className="text-xs font-bold uppercase tracking-[0.12em] text-vermilion-700">Trust through process</p><h2 id="trust-title" className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Clear boundaries make sourcing easier to manage.</h2><p className="mt-3 text-base leading-7 text-muted">Product details, estimates, approvals, status changes, and operational handoffs are kept distinct so you can understand what is known at each stage.</p></div><div className="space-y-3">{["Supported marketplace links are identified before product details are reviewed.", "Supplier prices and delivery inputs remain distinct from the BDT estimate.", "Estimates explain that actual weight, supplier payment, and courier costs may change the final amount.", "If automatic product lookup needs manual review, the platform should say so clearly."].map((item) => <div key={item} className="flex gap-3 rounded-card border border-border bg-canvas p-4 text-sm leading-6"><span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-commerce-100 text-commerce-700"><Check aria-hidden="true" className="h-3.5 w-3.5" /></span><p>{item}</p></div>)}</div></div></section>

        <section className="content-shell py-16 sm:py-20" aria-labelledby="faq-title"><div className="max-w-reading"><p className="text-xs font-bold uppercase tracking-[0.12em] text-vermilion-700">Questions, answered</p><h2 id="faq-title" className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">A few useful basics.</h2></div><div className="mt-8 max-w-3xl divide-y divide-border rounded-card border border-border bg-surface"><Faq question="Which marketplaces are supported?">The platform is designed for supplier links from 1688, Taobao, and Tmall.</Faq><Faq question="Is an estimate the final cost?">No. An estimate is prepared from the available product, delivery, exchange, weight, shipping, and profit inputs. Actual weight, supplier payment, and courier costs can change the final amount.</Faq><Faq question="What happens if a product link cannot be resolved automatically?">The platform should show a clear manual-review state. A product should not be presented as confirmed until its details can be reviewed.</Faq><Faq question="What do I need to get started?">Create a client account and have a supplier link ready. You can then review the returned product information and request an estimate.</Faq></div></section>

        <section id="contact" className="scroll-mt-20 border-t border-border bg-surface" aria-labelledby="final-cta-title"><div className="content-shell py-16 text-center sm:py-20"><p className="text-xs font-bold uppercase tracking-[0.12em] text-vermilion-700">Ready when you are</p><h2 id="final-cta-title" className="mx-auto mt-2 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">Bring your next supplier link into a clearer workflow.</h2><p className="mx-auto mt-4 max-w-xl text-base leading-7 text-muted">Create an account to begin the product and estimate journey. Public content does not submit or save a product request.</p><div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row"><Link href="/auth/register" className={buttonClasses({ variant: "primary", size: "lg" })}>Create account <ArrowRight aria-hidden="true" className="h-4 w-4" /></Link><Link href="/auth/login" className={buttonClasses({ variant: "outline", size: "lg" })}>Sign in</Link></div></div></section>
      </main>
    </PublicShell>
  );
}

function DemoRow({ icon: Icon, label, detail, last = false }: { icon: typeof Link2; label: string; detail: string; last?: boolean }) {
  return <div className="flex items-center gap-3"><span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-commerce-100 text-commerce-700"><Icon aria-hidden="true" className="h-4 w-4" />{!last && <span className="absolute left-1/2 top-full h-4 w-px bg-commerce-200" aria-hidden="true" />}</span><div className="min-w-0"><p className="text-sm font-semibold">{label}</p><p className="text-xs text-muted">{detail}</p></div></div>;
}

function MarketplaceCard({ name, detail, icon: Icon }: { name: string; detail: string; icon: typeof Store }) {
  return <Card className="flex items-center gap-4 p-4 transition-colors duration-base hover:border-commerce-300 sm:p-5"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-control bg-commerce-100 text-commerce-700"><Icon aria-hidden="true" className="h-5 w-5" /></span><div><h3 className="font-semibold">{name}</h3><p className="mt-0.5 text-sm text-muted">{detail}</p></div></Card>;
}

function StepCard({ title, text, icon: Icon, index }: { title: string; text: string; icon: typeof Link2; index: number }) {
  return <Card className="relative p-5 sm:p-6"><div className="flex items-start justify-between gap-4"><span className="grid h-11 w-11 place-items-center rounded-control bg-commerce-100 text-commerce-700"><Icon aria-hidden="true" className="h-5 w-5" /></span><span className="text-sm font-bold tabular-nums text-muted">0{index}</span></div><h3 className="mt-5 text-lg font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-muted">{text}</p></Card>;
}

function Faq({ question, children }: { question: string; children: string }) {
  return <details className="group p-5 open:bg-surface-muted sm:p-6"><summary className="flex min-h-touch cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold marker:hidden [&::-webkit-details-marker]:hidden"><span>{question}</span><ChevronDown aria-hidden="true" className="h-5 w-5 shrink-0 text-muted transition-transform duration-base group-open:rotate-180" /></summary><p className="max-w-reading pr-8 pt-3 text-sm leading-6 text-muted">{children}</p></details>;
}
