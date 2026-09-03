import { AlertCircle, CheckCircle2, CircleAlert, Info } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

export type AlertVariant = "info" | "success" | "warning" | "danger";

const styles: Record<AlertVariant, { container: string; iconClass: string; icon: typeof Info }> = {
  info: { container: "border-info/30 bg-info/10 text-foreground", iconClass: "text-info", icon: Info },
  success: { container: "border-success/30 bg-success/10 text-foreground", iconClass: "text-success", icon: CheckCircle2 },
  warning: { container: "border-warning/30 bg-warning/10 text-foreground", iconClass: "text-warning", icon: CircleAlert },
  danger: { container: "border-danger/30 bg-danger/10 text-foreground", iconClass: "text-danger", icon: AlertCircle }
};

export function Alert({ variant = "info", title, children, className, role, ...props }: HTMLAttributes<HTMLDivElement> & { variant?: AlertVariant; title?: ReactNode }) {
  const Icon = styles[variant].icon;
  return (
    <div
      role={role ?? (variant === "danger" ? "alert" : "status")}
      className={cn("flex gap-3 rounded-card border p-4 text-sm", styles[variant].container, className)}
      {...props}
    >
      <Icon aria-hidden="true" className={cn("mt-0.5 h-5 w-5 shrink-0", styles[variant].iconClass)} />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        <div className={cn("leading-6", title && "mt-1")}>{children}</div>
      </div>
    </div>
  );
}
