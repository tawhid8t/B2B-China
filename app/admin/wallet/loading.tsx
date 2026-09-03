import { AppShell } from "@/components/app-shell";
import { LoadingState } from "@/components/ui";
export default function Loading() { return <AppShell title="Wallet ledger" eyebrow="Financial audit"><LoadingState label="Loading client wallets" /></AppShell>; }
