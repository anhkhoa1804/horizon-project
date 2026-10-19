import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-72" />
      <div className="grid grid-cols-2 gap-6 border-y border-border/60 py-6 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-12" />
        ))}
      </div>
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-32 w-full max-w-sm" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
