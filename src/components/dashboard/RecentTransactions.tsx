import { Link } from 'react-router-dom'
import { Receipt } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { CATEGORY_META } from '@/lib/categoryMeta'
import { formatCurrency } from '@/lib/formatCurrency'
import { formatDate } from '@/lib/formatDate'
import { mockTransactions } from '@/data/mockTransactions'
import { cn } from '@/lib/cn'

export function RecentTransactions() {
  const items = [...mockTransactions].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 7)

  return (
    <Card hoverable>
      <CardHeader
        title="Transactions"
        subtitle="Your latest payments and receipts"
        action={
          <Link to="/transactions" className="text-[10px] font-semibold uppercase tracking-[0.06em] text-rust hover:underline">
            View all
          </Link>
        }
      />

      {items.length === 0 ? (
        <EmptyState icon={<Receipt size={20} />} title="No transactions yet" description="Your financial journey starts here." />
      ) : (
        <ul className="-mx-1 divide-y divide-border-soft">
          {items.map((item) => {
            const meta = CATEGORY_META[item.category]
            const signedAmount = item.type === 'expense' ? -item.amount : item.amount
            return (
              <li key={item.id} className="flex items-center gap-3 px-1 py-2 transition-colors hover:bg-bg-soft">
                <span className="w-16 shrink-0 text-[10px] font-semibold uppercase tracking-[0.05em]" style={{ color: meta.color }}>
                  {meta.label}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-ink">{item.description}</span>
                <span className="hidden shrink-0 font-mono-figure text-[10px] text-ink-muted sm:block">{item.payment}</span>
                <span className="w-14 shrink-0 text-right font-mono-figure text-[10px] text-ink-muted">{formatDate(item.date)}</span>
                <span className={cn('w-20 shrink-0 text-right font-mono-figure text-xs font-bold', signedAmount < 0 ? 'text-ink' : 'text-success')}>
                  {formatCurrency(signedAmount, { signed: true })}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
