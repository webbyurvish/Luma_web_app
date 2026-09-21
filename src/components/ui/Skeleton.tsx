import { cn } from '@/lib/cn'

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-bg-soft', className)} />
}

export function KPICardSkeleton() {
  return (
    <div className="rounded-card border border-border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-9 rounded-full" />
      </div>
      <Skeleton className="mt-4 h-8 w-32" />
      <Skeleton className="mt-3 h-3 w-20" />
    </div>
  )
}

export function ChartCardSkeleton() {
  return (
    <div className="rounded-card border border-border bg-card p-5 shadow-card">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-6 h-48 w-full rounded-md" />
    </div>
  )
}

export function ListRowSkeleton() {
  return (
    <div className="flex items-center gap-3 py-3">
      <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-1/3" />
        <Skeleton className="h-3 w-1/4" />
      </div>
      <Skeleton className="h-4 w-16" />
    </div>
  )
}
