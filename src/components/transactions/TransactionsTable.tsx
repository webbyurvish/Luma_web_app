import { Ban, Receipt } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import { CATEGORY_META } from '@/lib/categoryMeta'
import { formatCurrency } from '@/lib/formatCurrency'
import { formatDate } from '@/lib/formatDate'
import { cn } from '@/lib/cn'
import type { Transaction } from '@/types'

interface TransactionsTableProps {
  transactions: Transaction[]
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onVoid: (transaction: Transaction) => void
}

export function TransactionsTable({ transactions, page, pageSize, onPageChange, onVoid }: TransactionsTableProps) {
  const pageCount = Math.max(1, Math.ceil(transactions.length / pageSize))
  const pageItems = transactions.slice((page - 1) * pageSize, page * pageSize)

  return (
    <Card>
      {transactions.length === 0 ? (
        <EmptyState icon={<Receipt size={20} />} title="No transactions found" description="Try adjusting your search or filters." />
      ) : (
        <>
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
                  <th className="py-2 pl-2 pr-3 font-semibold">Category</th>
                  <th className="py-2 pr-3 font-semibold">Description</th>
                  <th className="py-2 pr-3 font-semibold">Type</th>
                  <th className="py-2 pr-3 font-semibold">Date</th>
                  <th className="py-2 pr-3 font-semibold">Payment</th>
                  <th className="py-2 pr-2 text-right font-semibold">Amount</th>
                  <th className="py-2 pl-2 pr-2" aria-hidden="true" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border-soft">
                {pageItems.map((item) => {
                  const meta = CATEGORY_META[item.category]
                  const signedAmount = item.type === 'expense' ? -item.amount : item.amount
                  return (
                    <tr key={item.id} className="group transition-colors hover:bg-bg-soft">
                      <td className="py-2.5 pl-2 pr-3 text-[10px] font-semibold uppercase tracking-[0.05em]" style={{ color: meta.color }}>
                        {meta.label}
                      </td>
                      <td className="py-2.5 pr-3 text-xs font-medium text-ink">{item.description}</td>
                      <td className="py-2.5 pr-3 text-xs capitalize text-ink-soft">{item.type}</td>
                      <td className="py-2.5 pr-3 font-mono-figure text-xs text-ink-muted">{formatDate(item.date)}</td>
                      <td className="py-2.5 pr-3 text-xs text-ink-soft">{item.payment}</td>
                      <td
                        className={cn(
                          'py-2.5 pr-2 text-right font-mono-figure text-xs font-bold',
                          signedAmount < 0 ? 'text-ink' : 'text-success',
                        )}
                      >
                        {formatCurrency(signedAmount, { signed: true })}
                      </td>
                      <td className="py-2.5 pl-2 pr-2 text-right">
                        {item.sourceId && (
                          <button
                            type="button"
                            onClick={() => onVoid(item)}
                            aria-label={`Void ${item.description}`}
                            className="rounded-full p-1.5 text-ink-muted opacity-0 transition-colors hover:bg-danger-soft hover:text-danger group-hover:opacity-100 group-focus-within:opacity-100"
                          >
                            <Ban size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageCount={pageCount} onPageChange={onPageChange} />
        </>
      )}
    </Card>
  )
}
