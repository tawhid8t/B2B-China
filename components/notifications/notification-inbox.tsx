"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bell, Check, CircleDollarSign, CreditCard, ShoppingCart, WalletCards } from "lucide-react";
import { Badge, Button, Card, EmptyState, ErrorState } from "@/components/ui";
import type { AppNotification } from "@/services/notification-service";

type Inbox = { notifications: AppNotification[]; page: number; pageSize: number; total: number; unread: number };

export function NotificationInbox({ inbox, workspace }: { inbox: Inbox; workspace: "client" | "admin" }) {
  const router = useRouter();
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pages = Math.max(1, Math.ceil(inbox.total / inbox.pageSize));

  async function markRead(id: string) {
    setWorking(id);
    setError(null);
    try {
      const response = await fetch(`/api/notifications/${id}/read`, { method: "POST" });
      if (!response.ok) throw new Error();
      router.refresh();
    } catch {
      setError("The notification could not be marked as read. Please try again.");
    } finally {
      setWorking(null);
    }
  }

  if (inbox.notifications.length === 0) {
    return <EmptyState title="No notifications yet" description="Wallet and payment updates addressed to you will appear here." />;
  }

  return <div className="space-y-4">
    {error && <ErrorState title="Update failed" description={error} className="py-5" />}
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted"><span className="font-semibold text-foreground">{inbox.unread}</span> unread · {inbox.total} total</p>
      <Badge variant={inbox.unread ? "warning" : "success"}>{inbox.unread ? "Action may be needed" : "All caught up"}</Badge>
    </div>
    <div className="space-y-3">
      {inbox.notifications.map((notification) => {
        const Icon = iconFor(notification.eventType);
        const href = entityHref(notification, workspace);
        return <Card key={notification.id} className={`p-4 sm:p-5 ${notification.readAt ? "" : "border-accent-mint bg-action-soft/40"}`}>
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-action-soft text-action-primary"><Icon className="h-5 w-5" aria-hidden="true" /></div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><h2 className="font-semibold">{notification.title}</h2><p className="mt-1 text-sm leading-6 text-muted">{notification.body}</p></div>
                {!notification.readAt && <Badge variant="info">Unread</Badge>}
              </div>
              <p className="mt-2 text-xs text-muted">{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(notification.createdAt))}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {href && <Link href={href} className="inline-flex min-h-touch items-center rounded-control border border-border px-3 py-2 text-sm font-semibold hover:bg-surface-muted">View details</Link>}
                {!notification.readAt && <Button size="sm" variant="outline" loading={working === notification.id} onClick={() => void markRead(notification.id)}><Check className="h-4 w-4" />Mark read</Button>}
              </div>
            </div>
          </div>
        </Card>;
      })}
    </div>
    {pages > 1 && <nav aria-label="Notification pages" className="flex items-center justify-between gap-3">
      <PageLink disabled={inbox.page <= 1} href={`?page=${inbox.page - 1}`}>Previous</PageLink>
      <p className="text-sm text-muted">Page {inbox.page} of {pages}</p>
      <PageLink disabled={inbox.page >= pages} href={`?page=${inbox.page + 1}`}>Next</PageLink>
    </nav>}
  </div>;
}

function PageLink({ disabled, href, children }: { disabled: boolean; href: string; children: string }) {
  return disabled ? <span className="rounded-control border border-border px-3 py-2 text-sm text-muted opacity-50">{children}</span> : <Link className="rounded-control border border-border px-3 py-2 text-sm font-semibold hover:bg-surface-muted" href={href}>{children}</Link>;
}

function iconFor(type: string) {
  if (type === "payment_proof_submitted" || type === "payment_review_result") return CreditCard;
  if (type === "wallet_insufficient") return CircleDollarSign;
  if (type === "reservation_released" || type === "wallet_corrected") return WalletCards;
  if (type.includes("order")) return ShoppingCart;
  return Bell;
}

function entityHref(notification: AppNotification, workspace: "client" | "admin") {
  if (notification.entityType === "payment_proof") return workspace === "admin" ? "/admin/payments" : "/client/wallet";
  if (notification.entityType === "order_item" && notification.entityId) return workspace === "admin" ? `/admin/orders/${notification.entityId}` : `/client/orders/${notification.entityId}`;
  if (notification.entityType === "wallet_transaction") return workspace === "admin" ? "/admin/wallet" : "/client/wallet";
  return null;
}
