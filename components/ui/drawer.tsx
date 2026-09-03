"use client";

import { X } from "lucide-react";
import { useId, type MouseEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useManagedDialog } from "@/components/ui/use-managed-dialog";
import { cn } from "@/lib/ui/cn";

export type DrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  side?: "bottom" | "right";
  className?: string;
  closeLabel?: string;
};

const placement = {
  bottom: "inset-x-0 bottom-0 mt-auto max-h-[calc(100dvh-0.5rem)] w-full max-w-none rounded-t-sheet border-x-0 border-b-0",
  right: "inset-y-0 right-0 ml-auto h-[100dvh] max-h-none w-full max-w-md rounded-none border-y-0 border-r-0"
};

export function Drawer({ open, onOpenChange, title, description, children, footer, side = "bottom", className, closeLabel = "Close panel" }: DrawerProps) {
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
      className={cn("z-modal m-0 overflow-hidden border border-border bg-surface p-0 text-foreground shadow-overlay", placement[side])}
    >
      <section className={cn("flex h-full max-h-[inherit] flex-col", className)}>
        {side === "bottom" && <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border" />}
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
        {footer && <footer className="safe-area-bottom shrink-0 border-t border-border bg-surface px-5 pt-4 shadow-[0_-8px_24px_rgba(9,52,37,0.06)] sm:px-6">{footer}</footer>}
      </section>
    </dialog>
  );
}

export function BottomSheet(props: Omit<DrawerProps, "side">) {
  return <Drawer {...props} side="bottom" />;
}
