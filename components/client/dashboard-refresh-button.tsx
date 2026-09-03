"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function DashboardRefreshButton() {
  const router = useRouter();
  return <Button variant="outline" size="icon" className="hidden sm:inline-flex sm:h-auto sm:w-auto sm:px-4 sm:py-2.5" aria-label="Refresh dashboard" onClick={() => router.refresh()}><RefreshCw aria-hidden="true" className="h-4 w-4" /><span>Refresh dashboard</span></Button>;
}
