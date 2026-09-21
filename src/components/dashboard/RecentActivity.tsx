import { Inbox } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ListRowSkeleton } from '@/components/ui/Skeleton'
import { CATEGORY_META } from '@/lib/categoryMeta'
import { formatCurrency } from '@/lib/formatCurrency'
import { formatRelativeDate } from '@/lib/formatDate'
import { mockTransactions } from '@/data/mockTransactions'
import { cn } from '@/lib/cn'

export function RecentActivity({ loading }: { loading?: boolean }) {
  const items = [...mockTransactions].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 7)

  const groups = items.reduce<Record<string, typeof items>>((acc, item) => {
    const key = formatRelativeDate(item.date)
    acc[key] = acc[key] ? [...acc[key], item] : [item]
    return acc
  }, {})

  return (
    <Card hoverable className="h-full">
      <CardHeader title="Recent activity" subtitle="Latest movements across your accounts" />

      {loading ? (
        <div className="divide-y divide-border-soft">
          {Array.from({ length: 5 }).map((_, index) => (
            <ListRowSkeleton key={index} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={<Inbox size={20} />} title="No activity yet" description="Your recent transactions will show up here." />
      ) : (
        <div className="space-y-4">
          {Object.entries(groups).map(([day, dayItems]) => (
            <div key={day}>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-muted">{day}</p>
              <ul className="-mx-1 divide-y divide-border-soft">
                {dayItems.map((item) => {
                  const meta = CATEGORY_META[item.category]
                  const isPositive = item.type === 'income' || item.type === 'udhaar'
                  const signedAmount = item.type === 'expense' ? -item.amount : item.amount
                  return (
                    <li key={item.id} className="flex items-center gap-2.5 px-1 py-1.5 transition-colors hover:bg-bg-soft">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: meta.color }} aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-ink">{item.description}</p>
                        <p className="text-[10px] uppercase tracking-[0.04em] text-ink-muted">
                          {meta.label} · {item.payment}
                        </p>
                      </div>
                      <p className={cn('shrink-0 font-mono-figure text-xs', isPositive ? 'text-success' : 'text-ink')}>
                        {formatCurrency(signedAmount, { signed: true })}
                      </p>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
