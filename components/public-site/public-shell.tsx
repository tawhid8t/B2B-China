import { ArrowUpRight, Boxes } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { PublicHeader } from "@/components/public-site/public-header";

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas text-foreground">
      <PublicHeader />
      {children}
      <PublicFooter />
    </div>
  );
}

function PublicFooter() {
  return (
    <footer className="border-t border-border bg-commerce-950 text-white">
      <div className="content-shell grid gap-10 py-12 sm:grid-cols-[1.4fr_1fr_1fr] sm:py-16">
        <div>
          <Link href="/" className="focus-ring inline-flex items-center gap-2.5 rounded-control" aria-label="BridgeCart home">
            <span className="grid h-9 w-9 place-items-center rounded-control bg-commerce-500 text-white"><Boxes aria-hidden="true" className="h-5 w-5" /></span>
            <span className="text-lg font-bold tracking-tight">BridgeCart</span>
          </Link>
          <p className="mt-4 max-w-sm text-sm leading-6 text-white/70">A clear way for Bangladesh businesses to source from China marketplaces and manage the handoffs that follow.</p>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">Explore</h2>
          <nav className="mt-3 flex flex-col items-start gap-2 text-sm text-white/70">
            <Link href="/services" className="focus-ring rounded-control py-1 hover:text-white">Services</Link>
            <Link href="/how-it-works" className="focus-ring rounded-control py-1 hover:text-white">How it works</Link>
            <Link href="/shipping" className="focus-ring rounded-control py-1 hover:text-white">Shipping</Link>
            <Link href="/product-rules" className="focus-ring rounded-control py-1 hover:text-white">Product rules</Link>
          </nav>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">Start here</h2>
          <p className="mt-3 text-sm leading-6 text-white/70">Create an account when you have a supplier link ready. Public preview content never creates an order.</p>
          <Link href="/auth/register" className="focus-ring mt-4 inline-flex items-center gap-1.5 rounded-control py-2 text-sm font-semibold text-white underline decoration-white/40 underline-offset-4 hover:decoration-white">Create account <ArrowUpRight aria-hidden="true" className="h-4 w-4" /></Link>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="content-shell flex flex-col gap-2 py-4 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} BridgeCart. Sourcing from China to Bangladesh.</p>
          <p>Estimates are subject to actual supplier, weight, and courier costs.</p>
        </div>
      </div>
    </footer>
  );
}
