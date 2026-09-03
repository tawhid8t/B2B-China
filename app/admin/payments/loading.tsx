import { AppShell } from "@/components/app-shell";
import { LoadingState } from "@/components/ui";
export default function Loading() { return <AppShell title="Payment review" eyebrow="Wallet funding"><LoadingState label="Loading payment proofs" /></AppShell>; }
