import Link from "next/link";
import { ReactNode } from "react";
import { Bell, Boxes, ClipboardList, CreditCard, Home, PackageCheck, ShoppingCart, TriangleAlert, UsersRound, WalletCards } from "lucide-react";
import { SignOutButton } from "@/components/sign-out-button";

const nav = [
  { href: "/admin", label: "Dashboard", icon: Home },
  { href: "/admin/orders/review", label: "Review queue", icon: ClipboardList },
  { href: "/admin/orders", label: "All orders", icon: PackageCheck },
  { href: "/admin/purchasing", label: "Purchase queue", icon: ShoppingCart },
  { href: "/admin/purchasing/purchased", label: "Purchased", icon: PackageCheck },
  { href: "/admin/purchasing/exceptions", label: "Exceptions", icon: TriangleAlert },
  { href: "/admin/extension", label: "Extension", icon: ClipboardList },
  { href: "/admin/clients", label: "Clients", icon: UsersRound },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/wallet", label: "Wallet ledger", icon: WalletCards },
  { href: "/admin/notifications", label: "Notifications", icon: Bell }
];

export function AppShell({ title, eyebrow, children }: { title: string; eyebrow: string; children: ReactNode }) {
  return (
    <main className="min-h-screen bg-paper">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-line bg-white/85 p-5 lg:block">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-jade text-white">
            <Boxes size={22} />
          </div>
          <div>
            <p className="text-sm text-ink/60">China to Bangladesh</p>
            <h1 className="text-lg font-semibold">BridgeCart Ops</h1>
          </div>
        </div>
        <nav className="space-y-1">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-ink/75 hover:bg-paper hover:text-ink">
              <item.icon size={18} />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <section className="lg:pl-64">
        <header className="border-b border-line bg-white/80 px-5 py-5 backdrop-blur md:px-8">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-sm font-semibold uppercase tracking-wide text-coral">{eyebrow}</p><h2 className="mt-1 text-3xl font-semibold text-ink">{title}</h2></div>
            <SignOutButton />
          </div>
        </header>
        <nav aria-label="Mobile admin navigation" className="flex gap-2 overflow-x-auto border-b border-line bg-white px-5 py-2 lg:hidden">
          {nav.map((item) => <Link key={item.href} href={item.href} className="flex min-h-11 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium text-ink/75 hover:bg-paper hover:text-ink"><item.icon size={16} />{item.label}</Link>)}
        </nav>
        <div className="px-5 py-6 md:px-8">{children}</div>
      </section>
    </main>
  );
}
