import type { CSSProperties } from 'react'
import { cn } from '@/lib/cn'

export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  // cn() doesn't merge Tailwind conflicts, so only apply the default radius when the caller didn't pick one.
  const hasRadius = /(^|\s)rounded(-|\s|$)/.test(className ?? '')
  return <div className={cn('skeleton-shimmer animate-shimmer', !hasRadius && 'rounded-md', className)} style={style} />
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

/** Matches FinanceStatTile's exact chrome (border, padding, radius) so the
 *  swap to real content never shifts layout. */
export function StatTileSkeleton() {
  return (
    <div className="rounded-sm border border-border-soft bg-surface px-3.5 py-3">
      <Skeleton className="h-2.5 w-16" />
      <Skeleton className="mt-2 h-5 w-20" />
    </div>
  )
}

/** A bare label+value pair with no card chrome, for grids like
 *  FinancialHealthSnapshot where the wrapping Card is already provided. */
export function LabelValueSkeleton() {
  return (
    <div>
      <Skeleton className="h-2.5 w-20" />
      <Skeleton className="mt-1.5 h-4.5 w-16" />
    </div>
  )
}

/** Mirrors NetWorthPanel's layout: hero value + liabilities aside on top,
 *  four proportional bar rows below. */
export function NetWorthPanelSkeleton() {
  return (
    <div className="rounded-card border border-border bg-card p-5 shadow-card">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="mt-2 h-9 w-40" />
          <Skeleton className="mt-3 h-3 w-32" />
        </div>
        <div className="shrink-0 border-t border-border-soft pt-3 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
          <Skeleton className="h-2.5 w-16" />
          <Skeleton className="mt-2 h-5 w-20" />
        </div>
      </div>
      <div className="mt-6 space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-2.5 w-28 shrink-0" />
            <Skeleton className="h-[5px] flex-1 rounded-xs" />
            <Skeleton className="h-3 w-16 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Mirrors one row of UpcomingFinance's list: a date badge instead of the
 *  avatar circle ListRowSkeleton uses, so nothing shifts on swap. */
export function UpcomingRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-1.5 py-2.5">
      <Skeleton className="h-3 w-10 shrink-0" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-3 w-2/5" />
        <Skeleton className="h-2.5 w-1/3" />
      </div>
      <Skeleton className="h-3 w-12 shrink-0" />
    </div>
  )
}

/** A single skeleton block sized for inline text, for spots where a stat
 *  swaps in place (e.g. a value next to its label) rather than a whole card. */
export function InlineValueSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn('h-3.5 w-14 rounded', className)} />
}

/** Compact row list matching the finance rows (small icon, name + meta, figure), with a
 *  gentle stagger so a long wait reads as "arriving" rather than frozen. */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="divide-y divide-border-soft" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-2 py-2.5" style={{ opacity: 1 - i * (0.5 / rows) }}>
          <Skeleton className="h-[26px] w-[26px] shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3" style={{ width: `${46 - (i % 3) * 8}%` }} />
            <Skeleton className="h-2.5 w-1/4" />
          </div>
          <Skeleton className="h-3 w-16 shrink-0" />
        </div>
      ))}
    </div>
  )
}
