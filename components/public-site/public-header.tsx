"use client";

import { Boxes, Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/ui/cn";

const navItems = [
  { label: "Services", href: "/services" },
  { label: "How it works", href: "/how-it-works" },
  { label: "Shipping", href: "/shipping" },
  { label: "Product rules", href: "/product-rules" },
  { label: "Contact", href: "/contact" }
];

export function PublicHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="safe-area-top sticky top-0 z-navigation border-b border-border/80 bg-surface/95 backdrop-blur">
      <div className="content-shell flex min-h-16 items-center justify-between gap-4">
        <Link href="/" className="focus-ring flex min-w-0 items-center gap-2.5 rounded-control" aria-label="BridgeCart home">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-control bg-commerce-700 text-white shadow-sm">
            <Boxes aria-hidden="true" className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-muted">China to Bangladesh</span>
            <span className="block truncate text-lg font-bold leading-tight tracking-tight text-foreground">BridgeCart</span>
          </span>
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-5 lg:flex">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="focus-ring rounded-control px-1 py-2 text-sm font-semibold text-muted transition-colors duration-fast hover:text-foreground">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden shrink-0 items-center gap-2 sm:flex">
          <Link href="/auth/login" className={buttonClasses({ variant: "outline", size: "sm" })}>Sign in</Link>
          <Link href="/auth/register" className={buttonClasses({ variant: "primary", size: "sm" })}>Create account</Link>
        </div>

        <div className="flex items-center gap-2 sm:hidden">
          <Link href="/auth/login" className="focus-ring rounded-control px-2 py-2 text-sm font-semibold text-commerce-800">Sign in</Link>
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-controls="public-mobile-menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((current) => !current)}
            className="focus-ring grid min-h-touch min-w-touch place-items-center rounded-control border border-border bg-surface text-foreground"
          >
            {menuOpen ? <X aria-hidden="true" className="h-5 w-5" /> : <Menu aria-hidden="true" className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <div id="public-mobile-menu" hidden={!menuOpen} className="border-t border-border bg-surface px-4 pb-5 pt-3 sm:hidden">
        <nav aria-label="Mobile navigation" className="content-shell flex flex-col gap-1 px-0">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className="focus-ring min-h-touch rounded-control px-3 py-3 text-base font-semibold text-foreground hover:bg-surface-muted">
              {item.label}
            </Link>
          ))}
          <Link href="/auth/register" onClick={() => setMenuOpen(false)} className={cn(buttonClasses({ variant: "primary", size: "lg" }), "mt-2 w-full")}>Create account</Link>
        </nav>
      </div>
    </header>
  );
}
