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
  const items = [...mockTransactions].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5)

  return (
    <Card className="h-full">
      <CardHeader title="Recent Activity" subtitle="Latest movements across your accounts" />

      {loading ? (
        <div className="divide-y divide-border">
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
        <ul className="divide-y divide-border">
          {items.map((item) => {
            const meta = CATEGORY_META[item.category]
            const Icon = meta.icon
            const isPositive = item.type === 'income' || item.type === 'udhaar'
            const signedAmount = item.type === 'expense' ? -item.amount : item.amount
            return (
              <li key={item.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: meta.bg, color: meta.color }}
                >
                  <Icon size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{item.description}</p>
                  <p className="text-xs text-ink-soft">
                    {meta.label} · {formatRelativeDate(item.date)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={cn('text-sm font-semibold', isPositive ? 'text-success' : 'text-ink')}>
                    {formatCurrency(signedAmount, { signed: true })}
                    {item.type === 'udhaar' && item.status === 'pending' ? ' receivable' : ''}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
