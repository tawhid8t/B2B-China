"use client";

import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  CreditCard,
  FileText,
  Home,
  Inbox,
  Info,
  LayoutGrid,
  Mail,
  Menu,
  Package,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  UserRound,
  WalletCards,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  Alert,
  Badge,
  BottomSheet,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Modal,
  PageHeader,
  PriceDisplay,
  ProductThumbnail,
  QuantityStepper,
  Skeleton,
  StatusBadge,
  Tabs,
  Textarea,
} from "@/components/ui";
import type { OrderStatus } from "@/lib/domain/types";
import { cn } from "@/lib/ui/cn";

const statuses: OrderStatus[] = ["pending_admin_review", "confirmed", "purchased", "received_china", "ready_for_pickup", "exception"];

const swatches = [
  ["Canvas", "bg-canvas", "#F8FAFA"],
  ["Surface", "bg-surface", "#FFFFFF"],
  ["Muted surface", "bg-surface-muted", "#F5F8F8"],
  ["Primary", "bg-action-primary text-on-action", "#002A31"],
  ["Action soft", "bg-action-soft", "#E7F4F2"],
  ["Mint", "bg-accent-mint", "#55D6BE"],
  ["Aqua", "bg-accent-aqua", "#45C4DD"],
  ["Violet", "bg-accent-violet text-on-action", "#7C6CFF"],
  ["Coral", "bg-accent-coral", "#F27868"],
] as const;

export function ClientDesignSystemGallery() {
  const [quantity, setQuantity] = useState(12);
  const [activeTab, setActiveTab] = useState("overview");
  const [activeNav, setActiveNav] = useState("Home");
  const [modalOpen, setModalOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [shippingCategory, setShippingCategory] = useState("general");
  const [shippingMenuOpen, setShippingMenuOpen] = useState(false);

  return (
    <main className="client-theme design-system-preview min-h-screen bg-canvas pb-12 text-foreground">
      <div className="mx-auto w-full max-w-commerce px-[var(--page-gutter)] py-8 sm:py-10">
        <header className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-action-primary">Development-only preview</p>
            <h1 className="mt-2 text-[2rem] font-bold tracking-tight text-foreground">Client component gallery</h1>
            <p className="mt-2 max-w-reading text-sm leading-6 text-muted">Approved v1 tokens with deterministic fixtures. No business data, authentication, or API calls are used here.</p>
          </div>
          <Badge variant="commerce" className="w-fit">Phase 3 preview</Badge>
        </header>

        <GallerySection title="Foundations" description="Semantic colors, typography roles, spacing rhythm, shape, and elevation.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {swatches.map(([label, className, value]) => <div key={label} className="flex items-center gap-3 rounded-control border border-border bg-surface p-3"><span className={cn("h-10 w-10 shrink-0 rounded-control border border-border/60", className)} /><span><span className="block text-sm font-semibold">{label}</span><span className="block text-xs text-muted">{value}</span></span></div>)}
          </div>
          <Card className="mt-5 overflow-hidden"><CardContent className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4"><TypeSample label="Display / balance" className="text-3xl font-bold tracking-tight tabular-nums">CNY 8,420.00</TypeSample><TypeSample label="Page title" className="text-[2rem] font-bold leading-10 tracking-tight">Orders</TypeSample><TypeSample label="Section title" className="text-xl font-bold leading-7">Active shipments</TypeSample><TypeSample label="Body and caption" className="text-base leading-6">Track each order, selected variant, saved cost, and fulfillment status.<span className="mt-2 block text-xs font-medium leading-4 text-muted">Updated just now</span></TypeSample></CardContent></Card>
        </GallerySection>

        <GallerySection title="Actions and fields" description="Touch-sized controls, labelled fields, errors, hints, and loading states.">
          <Card><CardContent className="space-y-6"><div><p className="text-sm font-semibold text-foreground">Action hierarchy</p><p className="mt-1 text-sm text-muted">Hover for a restrained elevation change; press for concise tactile feedback.</p></div><div className="flex flex-wrap items-center gap-3"><Button><CreditCard aria-hidden="true" className="h-4 w-4" />Continue to estimate <ArrowRight aria-hidden="true" className="h-4 w-4" /></Button><Button variant="secondary"><FileText aria-hidden="true" className="h-4 w-4" />Save draft</Button><Button variant="outline"><Check aria-hidden="true" className="h-4 w-4" />Review details</Button><Button variant="ghost">View activity</Button><Button variant="danger">Remove item</Button><Button loading>Saving changes</Button><Button size="icon" variant="outline" aria-label="Open search"><Search aria-hidden="true" className="h-5 w-5" /></Button></div><div className="grid gap-5 lg:grid-cols-2"><div className="space-y-5"><Input id="gallery-email" label="Email" required placeholder="you@example.com" startAdornment={<Mail className="h-5 w-5" />} hint="We only use this to identify your account." /><ShippingCategoryMenu value={shippingCategory} open={shippingMenuOpen} onOpenChange={setShippingMenuOpen} onValueChange={setShippingCategory} /></div><div className="space-y-5"><Input id="gallery-error" label="1688 product link" defaultValue="not-a-valid-link" error="Enter a supported public product URL." /><Textarea id="gallery-note" label="Order note" placeholder="Optional details for the sourcing team" hint="Supplier notes are shown before confirmation." /></div></div></CardContent></Card>
        </GallerySection>

        <GallerySection title="Status and feedback" description="Use semantic states for truth and accents only for secondary visual hierarchy.">
          <div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader><h2 className="text-xl font-bold">Statuses</h2><p className="mt-1 text-sm text-muted">Canonical client labels remain owned by the domain adapter.</p></CardHeader><CardContent className="flex flex-wrap gap-2">{statuses.map((status) => <StatusBadge key={status} status={status} />)}<Badge variant="neutral">Neutral</Badge><Badge variant="commerce">Commerce</Badge></CardContent></Card><div className="grid gap-3"><Alert variant="info" title="Information">Rates and totals remain server-authoritative.</Alert><Alert variant="success" title="Payment verified">Funds are ready to use for eligible orders.</Alert><Alert variant="warning" title="Review needed">This request needs confirmation before purchase.</Alert><Alert variant="danger" title="Unable to save">Check the field and try again.</Alert></div></div>
        </GallerySection>

        <GallerySection title="Commerce compositions" description="Reusable product, quantity, price, and row anatomy with fixed example content.">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]"><Card><CardContent className="flex min-w-0 items-start gap-4"><ProductThumbnail src="/placeholder-product.svg" alt="Example product" size="lg" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">Product order</p><h2 className="mt-1 text-lg font-bold leading-6">Example wireless headphones</h2><p className="mt-1 text-sm text-muted">Black · 2 selected variants · 42 pieces</p></div><StatusBadge status="received_china" /></div><div className="mt-5 flex flex-wrap items-end justify-between gap-4 border-t border-border pt-4"><div><p className="text-xs font-semibold text-muted">Saved amount</p><PriceDisplay value={68400} currency="BDT" showCode size="lg" /></div><Button variant="ghost" size="sm">View details <ChevronRight aria-hidden="true" className="h-4 w-4" /></Button></div></div></CardContent></Card><Card><CardContent><QuantityStepper value={quantity} onChange={setQuantity} label="Quantity" max={99} /><p className="mt-5 text-sm text-muted">Estimated product subtotal</p><PriceDisplay value={1860} currency="CNY" showCode size="xl" className="mt-1" /></CardContent><CardFooter><Button className="w-full">Review estimate</Button></CardFooter></Card></div>
        </GallerySection>

        <GallerySection title="Navigation and content patterns" description="Phone navigation remains bounded and labelled; tables become readable rows before they overflow.">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]"><Card><CardContent><Tabs label="Gallery content tabs" value={activeTab} onValueChange={setActiveTab} items={[{ value: "overview", label: "Overview", content: <GalleryRow icon={<LayoutGrid aria-hidden="true" className="h-5 w-5" />} title="Business overview" detail="Authoritative wallet, order, and notification summaries." /> }, { value: "orders", label: "Orders", content: <GalleryRow icon={<ClipboardList aria-hidden="true" className="h-5 w-5" />} title="Order history" detail="Cards retain status, quantity, and cost at narrow widths." /> }, { value: "wallet", label: "Wallet", content: <GalleryRow icon={<WalletCards aria-hidden="true" className="h-5 w-5" />} title="Wallet activity" detail="Currency values use tabular figures and remain visible." /> }]} /></CardContent></Card><PhoneNavigation active={activeNav} onChange={setActiveNav} /></div>
        </GallerySection>

        <GallerySection title="Loading, empty, error, and overlays" description="Stable states for visual review, including the only interactive gallery controls.">
          <div className="grid gap-4 lg:grid-cols-3"><ProductLoadingPreview /><EmptyState title="No confirmed orders yet" description="Your first confirmed product selection will appear here." icon={<Inbox aria-hidden="true" className="h-5 w-5" />} action={<Button size="sm">Start an order</Button>} /><ErrorState title="Wallet unavailable" description="Refresh the page or try again later." action={<Button variant="outline" size="sm">Try again</Button>} /></div><Card className="mt-4"><CardContent className="flex flex-wrap items-center gap-4"><div className="flex-1"><p className="text-sm font-semibold">Skeleton geometry</p><div className="mt-3 space-y-2"><Skeleton className="h-4 w-36" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /></div></div><Button variant="outline" onClick={() => setModalOpen(true)}>Open confirmation</Button><Button onClick={() => setSheetOpen(true)}>Open selection sheet</Button></CardContent></Card>
        </GallerySection>
      </div>

      <Modal open={modalOpen} onOpenChange={setModalOpen} title="Confirm selection" description="This is a gallery-only interaction; no order is created." footer={<div className="flex justify-end gap-3"><Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button><Button onClick={() => setModalOpen(false)}>Confirm</Button></div>}><Alert variant="info" title="Deterministic fixture">The gallery uses fixed values so its states can later become screenshot baselines.</Alert></Modal>
      <BottomSheet open={sheetOpen} onOpenChange={setSheetOpen} title="Select SKU" description="Choose a visual state to inspect the mobile sheet treatment." footer={<Button className="w-full" onClick={() => setSheetOpen(false)}>Done</Button>}><div className="space-y-3"><GalleryRow icon={<Package aria-hidden="true" className="h-5 w-5" />} title="Navy / Large" detail="44.30 CNY · 1,240 pieces available" /><GalleryRow icon={<ShieldCheck aria-hidden="true" className="h-5 w-5" />} title="Black / XL" detail="44.30 CNY · 890 pieces available" /></div></BottomSheet>
    </main>
  );
}

function GallerySection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <section className="mt-10"><div className="mb-4"><h2 className="text-2xl font-bold tracking-tight">{title}</h2><p className="mt-1 text-sm leading-6 text-muted">{description}</p></div>{children}</section>;
}

function TypeSample({ label, className, children }: { label: string; className: string; children: ReactNode }) {
  return <div className="min-w-0"><p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted">{label}</p><div className={cn("min-w-0 break-words", className)}>{children}</div></div>;
}

function GalleryRow({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return <div className="flex min-w-0 items-center gap-3 rounded-control border border-border bg-surface p-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-control bg-action-soft text-action-primary">{icon}</span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{title}</span><span className="mt-0.5 block text-xs leading-5 text-muted">{detail}</span></span><ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted" /></div>;
}

function PhoneNavigation({ active, onChange }: { active: string; onChange: (label: string) => void }) {
  const items = [{ label: "Home", icon: Home }, { label: "Orders", icon: ClipboardList }, { label: "New order", icon: Plus, primary: true }, { label: "Wallet", icon: WalletCards }, { label: "Account", icon: UserRound }];
  return <Card className="overflow-hidden"><CardHeader><div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Phone navigation</h2><p className="mt-1 text-sm text-muted">Raised primary action follows the mobile reference.</p></div><Button aria-label="Open menu" variant="ghost" size="icon"><Menu aria-hidden="true" className="h-5 w-5" /></Button></div><p aria-live="polite" className="mt-3 text-xs font-semibold text-action-primary">{active} selected</p></CardHeader><CardContent className="px-0 pb-0 pt-8"><nav aria-label="Client mobile navigation" data-ui="phone-navigation" className="grid grid-cols-5 border-t border-border bg-surface px-1 pb-[max(0.55rem,env(safe-area-inset-bottom))] pt-2">{items.map(({ label, icon: Icon, primary }) => <button key={label} type="button" onClick={() => onChange(label)} aria-current={active === label ? "page" : undefined} aria-pressed={active === label} className={cn("focus-ring flex min-h-touch min-w-0 flex-col items-center justify-end gap-1 px-1 pb-1 text-center text-[0.625rem] font-semibold leading-4 transition-colors", active === label ? "text-action-primary" : "text-muted hover:text-foreground", primary && "relative -mt-8")}><span className={cn("grid h-8 w-8 place-items-center transition-colors", active === label && !primary && "rounded-control bg-action-soft", primary && "h-12 w-12 rounded-full border-4 border-surface bg-action-primary text-on-action shadow-panel")}><Icon aria-hidden="true" className={cn("h-[1.15rem] w-[1.15rem]", primary && "h-6 w-6")} /></span><span className={cn(primary && "mt-1")}>{label}</span></button>)}</nav></CardContent></Card>;
}

function ShippingCategoryMenu({ value, open, onOpenChange, onValueChange }: { value: string; open: boolean; onOpenChange: (open: boolean) => void; onValueChange: (value: string) => void }) {
  const options = [{ value: "general", label: "General cargo", detail: "Standard goods and routine handling" }, { value: "sensitive", label: "Sensitive cargo", detail: "Items requiring additional handling review" }];
  const selected = options.find((option) => option.value === value) ?? options[0];
  return <div className="relative" data-ui="shipping-category"><label id="gallery-category-label" className="mb-1.5 block text-sm font-semibold text-foreground">Shipping category</label><button type="button" aria-haspopup="listbox" aria-expanded={open} aria-labelledby="gallery-category-label gallery-category-value" onClick={() => onOpenChange(!open)} className="focus-ring shipping-category-trigger flex min-h-touch-lg w-full items-center gap-3 rounded-control border border-border bg-surface px-3.5 py-2.5 text-left shadow-sm"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-control bg-action-soft text-action-primary"><Package aria-hidden="true" className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span id="gallery-category-value" className="block text-sm font-semibold text-foreground">{selected.label}</span><span className="block truncate text-xs text-muted">{selected.detail}</span></span><ChevronDown aria-hidden="true" className={cn("h-5 w-5 shrink-0 text-muted transition-transform duration-fast", open && "rotate-180")} /></button>{open && <div role="listbox" aria-labelledby="gallery-category-label" className="shipping-category-menu absolute z-10 mt-2 w-full overflow-hidden rounded-control border border-border bg-surface p-1.5 shadow-panel">{options.map((option) => <button key={option.value} type="button" role="option" aria-selected={value === option.value} onClick={() => { onValueChange(option.value); onOpenChange(false); }} className={cn("focus-ring flex min-h-touch w-full items-center gap-3 rounded-control px-3 py-2.5 text-left transition-colors", value === option.value ? "bg-action-soft text-action-primary" : "text-foreground hover:bg-surface-muted")}><span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-control border", value === option.value ? "border-action-primary/20 bg-surface" : "border-transparent bg-surface-muted")}><Package aria-hidden="true" className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{option.label}</span><span className="block text-xs text-muted">{option.detail}</span></span>{value === option.value && <Check aria-hidden="true" className="h-4 w-4 shrink-0" />}</button>)}</div>}<p className="mt-1.5 text-sm text-muted">Choose handling requirements before you request an estimate.</p></div>;
}

function ProductLoadingPreview() {
  return <div data-ui="product-loading" role="status" aria-live="polite" className="relative min-h-40 overflow-hidden rounded-card border border-border bg-surface px-5 py-6"><div className="product-loading-scan" aria-hidden="true" /><div className="relative flex items-start gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-control border border-action-primary/15 bg-action-soft text-action-primary"><Store aria-hidden="true" className="h-6 w-6" /></span><div className="min-w-0"><p className="text-sm font-bold text-foreground">Preparing your product details</p><p className="mt-1 text-sm leading-5 text-muted">Reading title, price, variants, and supplier data.</p></div></div><div className="relative mt-6 flex items-center gap-2 text-xs font-semibold text-action-primary"><span className="h-2 w-2 rounded-full bg-accent-mint" /><span>Secure product check in progress</span></div><div className="relative mt-3 grid grid-cols-3 gap-2" aria-hidden="true"><span className="h-1.5 rounded-full bg-action-primary" /><span className="h-1.5 rounded-full bg-action-primary/30" /><span className="h-1.5 rounded-full bg-action-primary/15" /></div></div>;
}
