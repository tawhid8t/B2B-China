import { LoaderCircle } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/ui/cn";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-action-primary text-on-action shadow-sm hover:bg-action-hover active:bg-action-active",
  secondary: "bg-action-soft text-action-primary hover:bg-action-soft/75 active:bg-action-soft/60",
  outline: "border border-border bg-surface text-foreground hover:bg-surface-muted active:bg-action-soft",
  ghost: "text-action-primary hover:bg-action-soft active:bg-action-soft/70",
  danger: "bg-danger-action text-on-action shadow-sm hover:bg-danger-action/90 active:bg-danger-action/80"
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "min-h-touch gap-2 px-3 py-2 text-sm",
  md: "min-h-touch gap-2 px-4 py-2.5 text-sm",
  lg: "min-h-touch-lg gap-2 px-5 py-3 text-base",
  icon: "h-11 w-11 justify-center p-0"
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading = false, disabled, children, type = "button", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      data-ui="button"
      data-variant={variant}
      data-size={size}
      className={cn(
        "focus-ring inline-flex shrink-0 items-center justify-center rounded-control font-semibold transition-colors duration-base ease-standard disabled:pointer-events-none disabled:opacity-55",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {loading && <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />}
      {children}
    </button>
  );
});

export function buttonClasses({ variant = "primary", size = "md", className }: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(
    "focus-ring inline-flex shrink-0 items-center justify-center rounded-control font-semibold transition-colors duration-base ease-standard",
    variantClasses[variant],
    sizeClasses[size],
    className
  );
}
