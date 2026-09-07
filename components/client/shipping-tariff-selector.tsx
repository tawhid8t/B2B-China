"use client";

import { Search } from "lucide-react";
import { useMemo } from "react";
import { Button, Input } from "@/components/ui";
import {
  SHIPPING_TARIFFS,
  type ShippingTariffItem,
} from "@/lib/shipping-tariffs";
import { cn } from "@/lib/ui/cn";

type ShippingTariffSelectorProps = {
  value?: ShippingTariffItem;
  query: string;
  onQueryChange: (value: string) => void;
  onSelect: (value: ShippingTariffItem) => void;
};

export function ShippingTariffSelector({
  value,
  query,
  onQueryChange,
  onSelect,
}: ShippingTariffSelectorProps) {
  const groups = useMemo(() => {
    const needle = normalize(query);
    const filtered = SHIPPING_TARIFFS.filter((tariff) => {
      if (!needle) return true;
      return normalize(`${tariff.group} ${tariff.item}`).includes(needle);
    });
    const grouped = new Map<string, ShippingTariffItem[]>();
    for (const tariff of filtered) {
      grouped.set(tariff.group, [...(grouped.get(tariff.group) ?? []), tariff]);
    }
    return Array.from(grouped.entries());
  }, [query]);

  return (
    <section className="min-w-0 space-y-3">
      <Input
        id="shipping-tariff-search"
        label="Shipping category"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Search product category..."
        hint={value ? `Selected: ${value.item} at Tk ${value.rateBdtPerKg}/kg` : "Select a tariff item to calculate international shipping."}
      />
      <div className="max-h-72 min-w-0 space-y-3 overflow-x-hidden overflow-y-auto rounded-card border border-border bg-surface p-3">
        {!groups.length && (
          <p className="px-1 py-3 text-sm text-muted">
            No tariff item matches this search.
          </p>
        )}
        {groups.map(([group, items]) => (
          <div key={group}>
            <p className="px-1 text-xs font-bold uppercase tracking-[0.1em] text-muted">
              {group}
            </p>
            <div className="mt-2 grid gap-1">
              {items.map((item) => {
                const selected = value?.group === item.group && value.item === item.item;
                return (
                  <Button
                    key={`${item.group}-${item.item}-${item.rateBdtPerKg}`}
                    variant={selected ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => onSelect(item)}
                    className={cn(
                      "h-auto min-w-0 w-full justify-between whitespace-normal px-3 py-2 text-left",
                      selected && "ring-1 ring-action-primary",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Search aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted" />
                      <span className="min-w-0 break-words">{item.item}</span>
                    </span>
                    <span className="shrink-0 pl-3 tabular-nums text-muted">
                      Tk {item.rateBdtPerKg}/kg
                    </span>
                  </Button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
