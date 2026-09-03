import { CircleHelp, ExternalLink, LockKeyhole, UserRound } from "lucide-react";
import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { Card, PageHeader } from "@/components/ui";
import { requireRoleForPath } from "@/lib/auth/session";

export default async function ClientAccountPage() {
  const { user } = await requireRoleForPath("/client/account");
  const fullName = typeof user.user_metadata.full_name === "string" ? user.user_metadata.full_name.trim() : "";
  const name = fullName || user.email?.split("@")[0] || "Client";

  return (
    <>
      <PageHeader eyebrow="Client workspace" title="Account" description="Your authenticated session and the help resources available in this release." />
      <div className="mt-7 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <Card className="p-5 sm:p-6"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-full bg-action-soft text-action-primary"><UserRound aria-hidden="true" className="h-5 w-5" /></span><div className="min-w-0"><h2 className="truncate text-lg font-semibold">{name}</h2><p className="truncate text-sm text-muted">{user.email ?? "No email available"}</p></div></div><p className="mt-6 text-sm leading-6 text-muted">Profile editing is not shown until its protected client data contract is available.</p><SignOutButton className="mt-5" /></Card>
        <Card className="p-5 sm:p-6"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-control bg-warning/10 text-warning"><CircleHelp aria-hidden="true" className="h-5 w-5" /></span><div><h2 className="text-lg font-semibold">Help before ordering</h2><p className="text-sm text-muted">Use the public guidance for product and shipping questions.</p></div></div><div className="mt-5 space-y-1"><HelpLink href="/product-rules" label="Product rules" /><HelpLink href="/restricted-products" label="Restricted products" /><HelpLink href="/shipping" label="Shipping guidance" /><HelpLink href="/contact" label="Contact guidance" /></div></Card>
      </div>
      <Card className="mt-4 p-5 sm:p-6"><div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-control bg-surface-muted text-muted"><LockKeyhole aria-hidden="true" className="h-5 w-5" /></span><div><h2 className="text-lg font-semibold">More client tools will appear here</h2><p className="mt-1 text-sm leading-6 text-muted">Favorites and settings remain unavailable until their protected APIs are implemented. Orders, wallet payments, and notifications are available from the workspace navigation. No sample financial data is shown.</p></div></div></Card>
    </>
  );
}

function HelpLink({ href, label }: { href: string; label: string }) {
  return <Link href={href} className="focus-ring flex min-h-touch items-center justify-between gap-3 rounded-control px-2 py-2 text-sm font-semibold text-action-primary hover:bg-action-soft"><span>{label}</span><ExternalLink aria-hidden="true" className="h-4 w-4" /></Link>;
}
