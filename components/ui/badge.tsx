import type { HTMLAttributes } from "react";
import { cn } from "@/lib/ui/cn";

export type BadgeVariant = "neutral" | "commerce" | "vermilion" | "gold" | "info" | "success" | "warning" | "danger";

const variantClasses: Record<BadgeVariant, string> = {
  neutral: "border-border bg-surface-muted text-foreground",
  commerce: "border-action-primary/20 bg-action-soft text-action-primary",
  vermilion: "border-accent-coral/30 bg-accent-coral/10 text-foreground",
  gold: "border-warning/30 bg-warning/10 text-foreground",
  info: "border-info/30 bg-info/10 text-foreground",
  success: "border-success/30 bg-success/10 text-foreground",
  warning: "border-warning/30 bg-warning/10 text-foreground",
  danger: "border-danger/30 bg-danger/10 text-foreground"
};

export function Badge({ variant = "neutral", className, ...props }: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn("inline-flex min-h-6 items-center rounded-full border px-2.5 py-1 text-xs font-semibold leading-none", variantClasses[variant], className)}
      {...props}
    />
  );
}
