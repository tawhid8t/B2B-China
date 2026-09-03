"use client";

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

export type TabItem = {
  value: string;
  label: ReactNode;
  content: ReactNode;
  disabled?: boolean;
};

export type TabsProps = {
  items: TabItem[];
  value: string;
  onValueChange: (value: string) => void;
  label: string;
  className?: string;
};

export function Tabs({ items, value, onValueChange, label, className }: TabsProps) {
  const baseId = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeItem = items.find((item) => item.value === value && !item.disabled) ?? items.find((item) => !item.disabled);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    const enabledIndices = items.map((item, index) => item.disabled ? -1 : index).filter((index) => index >= 0);
    const position = enabledIndices.indexOf(currentIndex);
    let nextIndex: number | undefined;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = enabledIndices[(position + 1) % enabledIndices.length];
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = enabledIndices[(position - 1 + enabledIndices.length) % enabledIndices.length];
    if (event.key === "Home") nextIndex = enabledIndices[0];
    if (event.key === "End") nextIndex = enabledIndices[enabledIndices.length - 1];
    if (nextIndex === undefined) return;

    event.preventDefault();
    const nextItem = items[nextIndex];
    onValueChange(nextItem.value);
    tabRefs.current[nextIndex]?.focus();
  }

  if (!activeItem) return null;
  const activeIndex = items.indexOf(activeItem);

  return (
    <div className={className}>
      <div role="tablist" aria-label={label} className="flex max-w-full gap-1 overflow-x-auto rounded-control bg-surface-muted p-1">
        {items.map((item, index) => {
          const selected = item.value === activeItem.value;
          return (
            <button
              key={item.value}
              ref={(node) => { tabRefs.current[index] = node; }}
              id={`${baseId}-tab-${index}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${index}`}
              tabIndex={selected ? 0 : -1}
              disabled={item.disabled}
              onClick={() => onValueChange(item.value)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={cn(
                "focus-ring min-h-touch shrink-0 rounded-md px-3.5 py-2 text-sm font-semibold transition-colors duration-fast disabled:opacity-45",
                selected ? "bg-surface text-action-primary shadow-sm" : "text-muted hover:bg-surface/70 hover:text-foreground"
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div
        id={`${baseId}-panel-${activeIndex}`}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${activeIndex}`}
        tabIndex={0}
        className="focus-ring mt-4 rounded-control"
      >
        {activeItem.content}
      </div>
    </div>
  );
}
