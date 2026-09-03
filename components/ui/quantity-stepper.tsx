"use client";

import { Minus, Plus } from "lucide-react";
import { useId, type ChangeEvent } from "react";
import { cn } from "@/lib/ui/cn";

export type QuantityStepperProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  disabled?: boolean;
  className?: string;
};

export function QuantityStepper({ value, onChange, min = 1, max, step = 1, label = "Quantity", disabled = false, className }: QuantityStepperProps) {
  const id = useId();
  const atMinimum = value <= min;
  const atMaximum = max !== undefined && value >= max;

  function commit(next: number) {
    const bounded = Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min, next));
    onChange(bounded);
  }

  function handleInput(event: ChangeEvent<HTMLInputElement>) {
    const next = Number.parseInt(event.target.value, 10);
    if (Number.isFinite(next)) commit(next);
  }

  return (
    <div className={cn("inline-flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-semibold text-foreground">{label}</label>
      <div className="inline-grid grid-cols-[2.75rem_minmax(3.5rem,5rem)_2.75rem] overflow-hidden rounded-control border border-border bg-surface shadow-sm">
        <button
          type="button"
          aria-label={`Decrease ${label.toLowerCase()}`}
          disabled={disabled || atMinimum}
          onClick={() => commit(value - step)}
          className="focus-ring grid min-h-touch place-items-center border-r border-border text-action-primary transition-colors hover:bg-action-soft disabled:text-muted disabled:opacity-45"
        >
          <Minus aria-hidden="true" className="h-4 w-4" />
        </button>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          value={value}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={handleInput}
          aria-label={label}
          className="focus-ring min-h-touch min-w-0 border-0 bg-surface px-1 text-center text-base font-semibold tabular-nums text-foreground [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <button
          type="button"
          aria-label={`Increase ${label.toLowerCase()}`}
          disabled={disabled || atMaximum}
          onClick={() => commit(value + step)}
          className="focus-ring grid min-h-touch place-items-center border-l border-border text-action-primary transition-colors hover:bg-action-soft disabled:text-muted disabled:opacity-45"
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
