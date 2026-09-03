"use client";

import { forwardRef, useId, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/ui/cn";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  wrapperClassName?: string;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { id: providedId, label, hint, error, className, wrapperClassName, required, rows = 4, ...props },
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
      <textarea
        ref={ref}
        id={id}
        rows={rows}
        required={required}
        aria-invalid={error ? true : props["aria-invalid"]}
        aria-describedby={describedBy}
        className={cn(
          "focus-ring w-full min-w-0 resize-y rounded-control border border-border bg-surface px-3.5 py-3 text-base text-foreground shadow-sm transition-colors duration-fast ease-standard placeholder:text-muted/75 hover:border-action-primary/30 disabled:bg-surface-muted disabled:text-muted sm:text-sm",
          Boolean(error) && "border-danger hover:border-danger",
          className
        )}
        {...props}
      />
      {hint && <p id={hintId} className="mt-1.5 text-sm text-muted">{hint}</p>}
      {error && <p id={errorId} role="alert" className="mt-1.5 text-sm font-medium text-danger">{error}</p>}
    </div>
  );
});
