import { TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

export function ErrorState({ title = "Something went wrong", description, action, className }: { title?: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <section role="alert" className={cn("rounded-card border border-danger/30 bg-danger/10 px-5 py-8 text-center sm:px-8", className)}>
      <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-danger/10 text-danger">
        <TriangleAlert aria-hidden="true" className="h-5 w-5" />
      </div>
      <h2 className="mt-4 text-base font-semibold text-foreground">{title}</h2>
      {description && <p className="mx-auto mt-1.5 max-w-reading text-sm leading-6 text-muted">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </section>
  );
}
