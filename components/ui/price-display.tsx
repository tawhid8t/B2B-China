import type { HTMLAttributes } from "react";
import { cn } from "@/lib/ui/cn";

export type SupportedCurrency = "BDT" | "CNY";

export type PriceDisplayProps = Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
  value: number | string;
  currency: SupportedCurrency;
  locale?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  size?: "sm" | "md" | "lg" | "xl";
  showCode?: boolean;
};

const sizeClasses = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-xl",
  xl: "text-3xl tracking-tight"
};

export function PriceDisplay({
  value,
  currency,
  locale = currency === "BDT" ? "en-BD" : "zh-CN",
  minimumFractionDigits,
  maximumFractionDigits = 2,
  size = "md",
  showCode = false,
  className,
  ...props
}: PriceDisplayProps) {
  const numericValue = typeof value === "number" ? value : Number(value);
  const formatted = Number.isFinite(numericValue)
      ? new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        currencyDisplay: showCode ? "code" : "narrowSymbol",
        minimumFractionDigits,
        maximumFractionDigits
      }).format(numericValue)
    : "Not available";

  return (
    <span
      data-currency={currency}
      className={cn("inline-flex max-w-full flex-wrap items-baseline gap-x-1 font-semibold tabular-nums text-foreground", sizeClasses[size], className)}
      {...props}
    >
      {formatted}
    </span>
  );
}
