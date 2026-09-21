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
  const items = [...mockTransactions].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 6)

  return (
    <Card>
      <CardHeader
        title="Recent Transactions"
        subtitle="Your latest payments and receipts"
        action={
          <Link to="/transactions" className="text-xs font-medium text-gold-dark hover:underline">
            View all
          </Link>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon={<Receipt size={22} />}
          title="No transactions yet"
          description="Your financial journey starts here."
        />
      ) : (
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-left text-xs font-medium text-ink-soft">
                <th className="px-2 pb-3 font-medium">Category</th>
                <th className="px-2 pb-3 font-medium">Description</th>
                <th className="px-2 pb-3 font-medium">Type</th>
                <th className="px-2 pb-3 font-medium">Date</th>
                <th className="px-2 pb-3 font-medium">Payment</th>
                <th className="px-2 pb-3 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const meta = CATEGORY_META[item.category]
                const Icon = meta.icon
                const signedAmount = item.type === 'expense' ? -item.amount : item.amount
                return (
                  <tr key={item.id} className="group transition-colors hover:bg-bg-soft">
                    <td className="border-t border-border px-2 py-3.5">
                      <span
                        className="flex h-8 w-8 items-center justify-center rounded-full"
                        style={{ backgroundColor: meta.bg, color: meta.color }}
                      >
                        <Icon size={15} />
                      </span>
                    </td>
                    <td className="border-t border-border px-2 py-3.5 font-medium text-ink">{item.description}</td>
                    <td className="border-t border-border px-2 py-3.5 capitalize text-ink-soft">{item.type}</td>
                    <td className="border-t border-border px-2 py-3.5 text-ink-soft">{formatDate(item.date)}</td>
                    <td className="border-t border-border px-2 py-3.5 text-ink-soft">{item.payment}</td>
                    <td
                      className={cn(
                        'border-t border-border px-2 py-3.5 text-right font-semibold',
                        signedAmount < 0 ? 'text-ink' : 'text-success',
                      )}
                    >
                      {formatCurrency(signedAmount, { signed: true })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
