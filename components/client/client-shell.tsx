"use client";

import { Bell, Boxes, CircleHelp, ClipboardList, FileSpreadsheet, Home, LockKeyhole, Menu, Plus, UserRound, WalletCards } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { SignOutButton } from "@/components/sign-out-button";
import { Badge, BottomSheet, Button } from "@/components/ui";
import { cn } from "@/lib/ui/cn";

type ClientShellProps = {
  user: { name: string; email: string };
  unreadNotificationCount: number | null;
  children: ReactNode;
  visualPathname?: string;
};

const clientRoutes = {
  home: { label: "Home", href: "/client", icon: Home, exact: true },
  newOrder: { label: "New order", href: "/client/order/new", icon: Plus, exact: false },
  orders: { label: "Orders", href: "/client/orders", icon: ClipboardList, exact: false },
  wallet: { label: "Wallet & payments", href: "/client/wallet", icon: WalletCards, exact: false },
  notifications: { label: "Notifications", href: "/client/notifications", icon: Bell, exact: false },
  statement: { label: "Product Statement", href: "/client/excel-details", icon: FileSpreadsheet, exact: false },
  account: { label: "Account", href: "/client/account", icon: UserRound, exact: false }
} as const;

const desktopItems = [clientRoutes.home, clientRoutes.newOrder, clientRoutes.orders, clientRoutes.wallet, clientRoutes.notifications, clientRoutes.statement];
const mobileItems = [clientRoutes.home, clientRoutes.orders, clientRoutes.newOrder, clientRoutes.wallet, clientRoutes.account];

const unavailableItems = ["Estimates", "Favorites", "Settings"];

export function ClientShell({ user, unreadNotificationCount, children, visualPathname }: ClientShellProps) {
  const runtimePathname = usePathname();
  const pathname = visualPathname ?? runtimePathname;
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuHistoryEntry = useRef<string | null>(null);
  const pendingMenuNavigation = useRef<string | null>(null);
  const pageTitle = pathname.startsWith("/client/order/new") ? "New order" : pathname.startsWith("/client/excel-details") ? "Excel details" : pathname.startsWith("/client/orders") ? "Orders" : pathname.startsWith("/client/wallet") ? "Wallet & payments" : pathname.startsWith("/client/notifications") ? "Notifications" : pathname.startsWith("/client/account") ? "Account" : "Dashboard";
  const isDashboard = pathname === "/client";

  useEffect(() => {
    function handlePopState() {
      if (!menuHistoryEntry.current) return;
      menuHistoryEntry.current = null;
      setMobileMenuOpen(false);
      const destination = pendingMenuNavigation.current;
      pendingMenuNavigation.current = null;
      if (destination) router.push(destination);
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [router]);

  useEffect(() => {
    if (!menuHistoryEntry.current) return;
    menuHistoryEntry.current = null;
    pendingMenuNavigation.current = null;
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const desktopMedia = window.matchMedia("(min-width: 1024px)");
    function closeForDesktop() {
      if (!desktopMedia.matches || !menuHistoryEntry.current) return;
      menuHistoryEntry.current = null;
      pendingMenuNavigation.current = null;
      setMobileMenuOpen(false);
      window.history.back();
    }

    desktopMedia.addEventListener("change", closeForDesktop);
    closeForDesktop();
    return () => desktopMedia.removeEventListener("change", closeForDesktop);
  }, []);

  function openMobileMenu() {
    if (mobileMenuOpen) return;
    const entry = `bridgecart-client-menu-${Date.now()}`;
    window.history.pushState({ ...window.history.state, bridgecartClientMenu: entry }, "", window.location.href);
    menuHistoryEntry.current = entry;
    setMobileMenuOpen(true);
  }

  function closeMobileMenu() {
    if (!mobileMenuOpen) return;
    if (menuHistoryEntry.current) {
      window.history.back();
      return;
    }
    setMobileMenuOpen(false);
  }

  function navigateFromMobileMenu(href: string) {
    pendingMenuNavigation.current = href;
    closeMobileMenu();
  }

  return (
    <div className="client-theme min-h-screen bg-canvas text-foreground">
      <aside className="fixed inset-y-0 left-0 z-navigation hidden w-72 flex-col border-r border-border bg-surface lg:flex">
        <ClientBrand />
        <nav aria-label="Client workspace" className="flex-1 overflow-y-auto px-3 py-5">
          <p className="px-3 text-xs font-bold uppercase tracking-[0.12em] text-muted">Workspace</p>
          <div className="mt-2 space-y-1">
            {desktopItems.map((item) => <DesktopNavItem key={item.href} {...item} active={isActive(pathname, item.href, item.exact)} />)}
          </div>
          <p className="mt-7 px-3 text-xs font-bold uppercase tracking-[0.12em] text-muted">Available later</p>
          <div className="mt-2 space-y-1">
            {unavailableItems.map((label) => <UnavailableNavItem key={label} label={label} />)}
          </div>
        </nav>
        <div className="border-t border-border p-3">
          <DesktopNavItem {...clientRoutes.account} active={isActive(pathname, clientRoutes.account.href)} />
          <Link href="/contact" className="focus-ring mt-1 flex min-h-touch items-center gap-3 rounded-control px-3 py-2.5 text-sm font-semibold text-muted transition-colors hover:bg-surface-muted hover:text-foreground"><CircleHelp aria-hidden="true" className="h-4 w-4" />Help</Link>
          <div className="mt-3 rounded-card bg-surface-muted p-3">
            <p className="truncate text-sm font-semibold text-foreground">{user.name}</p>
            {user.email && <p className="mt-0.5 truncate text-xs text-muted">{user.email}</p>}
            <SignOutButton className="mt-3 w-full justify-center" />
          </div>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className={cn("safe-area-top sticky top-0 z-navigation border-b border-border/80 bg-surface/95 backdrop-blur", isDashboard && "hidden lg:block")}>
          <div className="content-shell flex min-h-14 items-center justify-between gap-2 lg:min-h-16 lg:max-w-none lg:gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-2 lg:hidden">{isDashboard ? <span aria-hidden="true" /> : <><ClientBrand compact /><span className="min-w-0 truncate text-sm font-semibold text-muted">{pageTitle}</span></>}</div>
            <p className="hidden text-sm font-semibold text-muted lg:block">{pageTitle}</p>
            <div className="flex shrink-0 items-center gap-1"><NotificationLink unreadCount={unreadNotificationCount} /><Button variant="ghost" size="icon" className="lg:hidden" aria-expanded={mobileMenuOpen} aria-controls="client-mobile-menu" aria-label="Open workspace menu" onClick={openMobileMenu}><Menu aria-hidden="true" className="h-5 w-5" /></Button><Link href="/client/account" className="focus-ring hidden min-h-touch items-center gap-2 rounded-control px-1.5 py-1.5 text-sm font-semibold text-foreground hover:bg-surface-muted lg:flex" aria-label="Open account">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-action-soft text-action-primary"><UserRound aria-hidden="true" className="h-4 w-4" /></span>
              <span className="max-w-48 truncate">{user.name}</span>
            </Link></div>
          </div>
        </header>
        <main id="client-content" className="content-shell min-w-0 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-7 sm:pt-9 lg:pb-12 lg:pt-10">{children}</main>
      </div>

      <nav data-ui="client-mobile-navigation" aria-label="Mobile client navigation" className="safe-area-bottom fixed inset-x-0 bottom-0 z-navigation min-h-16 border-t border-border bg-surface/95 px-3 pt-2 shadow-overlay backdrop-blur lg:hidden">
        <div className="mx-auto grid min-w-0 max-w-lg grid-cols-5 gap-1">
          {mobileItems.map((item) => <MobileNavItem key={item.href} {...item} label={item.href === clientRoutes.wallet.href ? "Wallet" : item.label} active={isActive(pathname, item.href, item.exact)} primary={item.href === clientRoutes.newOrder.href} />)}
        </div>
      </nav>

      <BottomSheet open={mobileMenuOpen} onOpenChange={(open) => open ? openMobileMenu() : closeMobileMenu()} title="Workspace menu" description="Other available client destinations." closeLabel="Close workspace menu">
        <nav id="client-mobile-menu" aria-label="Secondary client destinations" className="space-y-1">
          <MobileMenuItem item={clientRoutes.statement} onNavigate={navigateFromMobileMenu} />
          <MobileMenuItem item={{ label: "Help", href: "/contact", icon: CircleHelp }} onNavigate={navigateFromMobileMenu} />
        </nav>
      </BottomSheet>
    </div>
  );
}

function ClientBrand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/client" className={cn("focus-ring flex min-w-0 items-center gap-2.5 rounded-control", compact ? "" : "border-b border-border px-5 py-5")} aria-label="BridgeCart client workspace">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-control bg-action-primary text-on-action shadow-sm"><Boxes aria-hidden="true" className="h-5 w-5" /></span>
      <span className="min-w-0"><span className="block truncate text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-muted">Client workspace</span><span className="block truncate text-lg font-bold leading-tight tracking-tight text-foreground">BridgeCart</span></span>
    </Link>
  );
}

function DesktopNavItem({ label, href, icon: Icon, active }: { label: string; href: string; icon: typeof Home; exact?: boolean; active: boolean }) {
  return <Link href={href} aria-current={active ? "page" : undefined} className={cn("focus-ring flex min-h-touch items-center gap-3 rounded-control px-3 py-2.5 text-sm font-semibold transition-colors", active ? "bg-action-soft text-action-primary" : "text-muted hover:bg-surface-muted hover:text-foreground")}><Icon aria-hidden="true" className="h-4 w-4" />{label}</Link>;
}

function UnavailableNavItem({ label }: { label: string }) {
  return <span aria-disabled="true" className="flex min-h-touch items-center gap-3 rounded-control px-3 py-2.5 text-sm font-semibold text-muted/70"><LockKeyhole aria-hidden="true" className="h-4 w-4" /><span className="min-w-0 flex-1 truncate">{label}</span><Badge className="shrink-0 px-2 py-0.5 text-[0.65rem]" variant="neutral">Later</Badge></span>;
}

function NotificationLink({ unreadCount }: { unreadCount: number | null }) {
  const hasUnread = unreadCount !== null && unreadCount > 0;
  const visualCount = unreadCount !== null && unreadCount > 99 ? "99+" : unreadCount;
  const label = hasUnread ? `Open notifications, ${unreadCount} unread` : "Open notifications";

  return <Link href={clientRoutes.notifications.href} className="focus-ring relative grid h-11 w-11 place-items-center rounded-control text-muted hover:bg-surface-muted hover:text-foreground" aria-label={label}><Bell aria-hidden="true" className="h-5 w-5" />{hasUnread && <span aria-hidden="true" className="absolute right-0.5 top-0.5 min-w-4 rounded-full bg-danger px-1 text-center text-[0.625rem] font-bold leading-4 text-on-action">{visualCount}</span>}</Link>;
}

function MobileMenuItem({ item, onNavigate }: { item: { label: string; href: string; icon: typeof Home }; onNavigate: (href: string) => void }) {
  const Icon = item.icon;
  return <button type="button" onClick={() => onNavigate(item.href)} className="focus-ring flex min-h-touch-lg w-full items-center gap-3 rounded-control px-3 py-3 text-left text-sm font-semibold text-foreground hover:bg-surface-muted"><span className="grid h-10 w-10 place-items-center rounded-control bg-action-soft text-action-primary"><Icon aria-hidden="true" className="h-5 w-5" /></span>{item.label}</button>;
}

function MobileNavItem({ label, href, icon: Icon, active, primary = false }: { label: string; href: string; icon: typeof Home; exact?: boolean; active: boolean; primary?: boolean }) {
  if (primary) return <Link href={href} aria-current={active ? "page" : undefined} className="focus-ring relative -mt-8 flex min-w-0 min-h-touch flex-col items-center justify-start rounded-control px-2 pt-0.5 text-center text-[0.7rem] font-semibold text-muted"><span className={cn("grid h-14 w-14 place-items-center rounded-full border-4 border-canvas shadow-panel", active ? "bg-action-active text-on-action" : "bg-action-primary text-on-action")}><Icon aria-hidden="true" strokeWidth={2.5} className="h-8 w-8" /></span><span className="mt-1.5 break-words">{label}</span></Link>;
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={cn("focus-ring flex min-w-0 min-h-touch flex-col items-center justify-center gap-0.5 rounded-control px-1 py-1.5 text-center text-[0.7rem] font-semibold", active ? "bg-action-soft text-action-primary" : "text-muted hover:bg-surface-muted hover:text-foreground")}>
      <span className={cn("grid h-8 w-8 place-items-center", active && "rounded-control bg-surface/80")}><Icon aria-hidden="true" className="h-5 w-5" /></span>{label}
    </Link>
  );
}

function isActive(pathname: string, href: string, exact = false) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}
