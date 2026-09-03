"use client";

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  startAdornment?: ReactNode;
  wrapperClassName?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { id: providedId, label, hint, error, startAdornment, className, wrapperClassName, required, ...props },
  ref
) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [props["aria-describedby"], hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("w-full", wrapperClassName)}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-foreground">
          {label}
          {required && <span className="ml-1 text-danger" aria-hidden="true">*</span>}
        </label>
      )}
      <div className="relative">
        <input
          ref={ref}
          id={id}
          required={required}
          aria-invalid={error ? true : props["aria-invalid"]}
          aria-describedby={describedBy}
          className={cn(
            "focus-ring min-h-touch-lg w-full min-w-0 rounded-control border border-border bg-surface px-3.5 py-2.5 text-base text-foreground shadow-sm transition-colors duration-fast ease-standard placeholder:text-muted/75 hover:border-action-primary/30 disabled:bg-surface-muted disabled:text-muted sm:text-sm",
            Boolean(startAdornment) && "pl-11",
            Boolean(error) && "border-danger hover:border-danger",
            className
          )}
          {...props}
        />
        {startAdornment && <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center text-muted">{startAdornment}</span>}
      </div>
      {hint && <p id={hintId} className="mt-1.5 text-sm text-muted">{hint}</p>}
      {error && <p id={errorId} role="alert" className="mt-1.5 text-sm font-medium text-danger">{error}</p>}
    </div>
  );
});
