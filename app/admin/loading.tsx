import { AppShell } from "@/components/app-shell";
import { LoadingState } from "@/components/ui";
export default function Loading() { return <AppShell title="Operations dashboard" eyebrow="Admin workspace"><LoadingState label="Loading protected dashboard" description="Reconciling live order, payment, and wallet summaries." /></AppShell>; }
