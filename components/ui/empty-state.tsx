import { Inbox } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

export function EmptyState({ title, description, action, icon, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-card border border-dashed border-border bg-surface px-5 py-10 text-center sm:px-8", className)}>
      <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-surface-muted text-muted">
        {icon ?? <Inbox aria-hidden="true" className="h-5 w-5" />}
      </div>
      <h2 className="mt-4 text-base font-semibold text-foreground">{title}</h2>
      {description && <p className="mx-auto mt-1.5 max-w-reading text-sm leading-6 text-muted">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </section>
  );
}
