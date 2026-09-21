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
  const items = [...mockTransactions].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 6)

  const groups = items.reduce<Record<string, typeof items>>((acc, item) => {
    const key = formatRelativeDate(item.date)
    acc[key] = acc[key] ? [...acc[key], item] : [item]
    return acc
  }, {})

  return (
    <Card hoverable className="h-full">
      <CardHeader title="Recent Activity" subtitle="Latest movements across your accounts" />

      {loading ? (
        <div className="divide-y divide-border-soft">
          {Array.from({ length: 5 }).map((_, index) => (
            <ListRowSkeleton key={index} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Inbox size={22} />}
          title="No activity yet"
          description="Your recent transactions will show up here."
        />
      ) : (
        <div className="space-y-5">
          {Object.entries(groups).map(([day, dayItems]) => (
            <div key={day}>
              <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{day}</p>
              <ul className="relative space-y-0.5 border-l border-border-soft pl-4">
                {dayItems.map((item) => {
                  const meta = CATEGORY_META[item.category]
                  const Icon = meta.icon
                  const isPositive = item.type === 'income' || item.type === 'udhaar'
                  const signedAmount = item.type === 'expense' ? -item.amount : item.amount
                  return (
                    <li key={item.id} className="group relative flex items-center gap-3 rounded-md py-2 pl-2 pr-1 transition-colors duration-150 hover:bg-bg-soft">
                      <span
                        className="absolute -left-[21px] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border-2 border-surface"
                        style={{ backgroundColor: meta.color }}
                        aria-hidden="true"
                      />
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                        style={{ backgroundColor: meta.bg, color: meta.color }}
                      >
                        <Icon size={15} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{item.description}</p>
                        <p className="text-xs text-ink-soft">
                          {meta.label} · {item.payment}
                        </p>
                      </div>
                      <p className={cn('shrink-0 text-sm font-semibold', isPositive ? 'text-success' : 'text-ink')}>
                        {formatCurrency(signedAmount, { signed: true })}
                        {item.type === 'udhaar' && item.status === 'pending' ? ' receivable' : ''}
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
