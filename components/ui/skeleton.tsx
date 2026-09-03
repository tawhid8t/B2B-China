import type { HTMLAttributes } from "react";
import { cn } from "@/lib/ui/cn";

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-md bg-border/60 motion-reduce:animate-none", className)} {...props} />;
}
