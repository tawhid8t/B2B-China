import { AppShell } from "@/components/app-shell";
import { LoadingState } from "@/components/ui";
export default function Loading() { return <AppShell title="Notifications" eyebrow="Admin inbox"><LoadingState label="Loading notifications" /></AppShell>; }
