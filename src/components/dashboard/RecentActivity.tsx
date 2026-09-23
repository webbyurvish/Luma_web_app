import { Link } from 'react-router-dom'
import { Inbox } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ListRowSkeleton } from '@/components/ui/Skeleton'
import { CATEGORY_META } from '@/lib/categoryMeta'
import { formatCurrency } from '@/lib/formatCurrency'
import { formatRelativeDate } from '@/lib/formatDate'
import { getRecentTransactions } from '@/lib/transactionCalculations'
import { cn } from '@/lib/cn'
import type { Transaction } from '@/types'

interface RecentActivityProps {
  loading?: boolean
  transactions: Transaction[]
}

export function RecentActivity({ loading, transactions }: RecentActivityProps) {
  const items = getRecentTransactions(transactions, 8)

  const groups = items.reduce<Record<string, typeof items>>((acc, item) => {
    const key = formatRelativeDate(item.date)
    acc[key] = acc[key] ? [...acc[key], item] : [item]
    return acc
  }, {})

  return (
    <Card hoverable className="h-full">
      <CardHeader
        title="Recent activity"
        subtitle="Latest movements across your accounts"
        action={
          <Link to="/transactions" className="text-[10px] font-semibold uppercase tracking-[0.06em] text-rust hover:underline">
            View all →
          </Link>
        }
      />

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
              <div className="mb-1 flex items-center gap-2.5">
                <p className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-muted">{day}</p>
                <span className="h-px flex-1 bg-border-soft" aria-hidden="true" />
              </div>
              <ul className="-mx-1.5 divide-y divide-border-soft">
                {dayItems.map((item) => {
                  const meta = CATEGORY_META[item.category]
                  const Icon = meta.icon
                  const isPositive = item.type === 'income' || item.type === 'udhaar'
                  const signedAmount = item.type === 'expense' ? -item.amount : item.amount
                  return (
                    <li key={item.id} className="flex items-center gap-2.5 px-1.5 py-2 transition-colors hover:bg-bg-soft">
                      <span
                        className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full"
                        style={{ backgroundColor: meta.bg, color: meta.color }}
                        aria-hidden="true"
                      >
                        <Icon size={10.5} strokeWidth={2.25} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-ink">{item.description}</p>
                        <p className="truncate text-[10.5px] text-ink-muted">
                          <span className="uppercase tracking-[0.03em]">{meta.label}</span> · {item.payment}
                        </p>
                      </div>
                      <span className="hidden shrink-0 font-mono-figure text-[10.5px] text-ink-muted sm:block">{item.time}</span>
                      <span
                        className={cn('w-[78px] shrink-0 text-right font-mono-figure text-xs font-semibold', isPositive ? 'text-success' : 'text-ink')}
                      >
                        {formatCurrency(signedAmount, { signed: true })}
                      </span>
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
