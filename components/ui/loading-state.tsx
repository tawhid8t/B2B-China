import { LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

export function LoadingState({ label = "Loading", description, className, compact = false }: { label?: ReactNode; description?: ReactNode; className?: string; compact?: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center justify-center gap-3 rounded-card border border-border bg-surface text-center text-muted",
        compact ? "px-4 py-4" : "min-h-40 flex-col px-5 py-8",
        className
      )}
    >
      <LoaderCircle aria-hidden="true" className="h-5 w-5 shrink-0 animate-spin text-action-primary motion-reduce:animate-none" />
      <div>
        <p className="text-sm font-semibold text-foreground">{label}</p>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
    </div>
  );
}
