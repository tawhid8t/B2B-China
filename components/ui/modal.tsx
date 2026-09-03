"use client";

import { X } from "lucide-react";
import { useId, type MouseEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useManagedDialog } from "@/components/ui/use-managed-dialog";
import { cn } from "@/lib/ui/cn";

export type ModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  closeLabel?: string;
};

export function Modal({ open, onOpenChange, title, description, children, footer, className, closeLabel = "Close dialog" }: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const { ref, handleCancel, handleClose } = useManagedDialog(open, onOpenChange);

  function closeFromBackdrop(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) onOpenChange(false);
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={handleCancel}
      onClose={handleClose}
      onClick={closeFromBackdrop}
      className="z-modal m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-hidden rounded-panel border border-border bg-surface p-0 text-foreground shadow-overlay"
    >
      <section className={cn("flex max-h-[calc(100dvh-2rem)] flex-col", className)}>
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold leading-7 text-foreground">{title}</h2>
            {description && <p id={descriptionId} className="mt-1 text-sm leading-6 text-muted">{description}</p>}
          </div>
          <Button variant="ghost" size="icon" aria-label={closeLabel} onClick={() => onOpenChange(false)} className="-mr-2 -mt-1">
            <X aria-hidden="true" className="h-5 w-5" />
          </Button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">{children}</div>
        {footer && <footer className="safe-area-bottom shrink-0 border-t border-border bg-surface px-5 pt-4 sm:px-6">{footer}</footer>}
      </section>
    </dialog>
  );
}
