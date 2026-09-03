import { Skeleton } from "@/components/ui";

export default function ClientLoading() {
  return (
    <div aria-label="Loading client workspace" role="status" className="space-y-7">
      <div className="space-y-3"><Skeleton className="h-3 w-28" /><Skeleton className="h-9 w-56 sm:w-72" /><Skeleton className="h-5 w-full max-w-xl" /></div>
      <Skeleton className="h-72 rounded-card sm:h-64" />
      <div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-64 rounded-card" /><Skeleton className="h-64 rounded-card" /></div>
    </div>
  );
}
