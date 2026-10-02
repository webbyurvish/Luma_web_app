import { useState } from 'react'
import { ArrowLeftRight, Ban, Pencil, Receipt, Trash2 } from 'lucide-react'
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
  onEdit: (transaction: Transaction) => void
  onDelete: (transaction: Transaction) => void
  /** Account id → name, to show where the money moved. */
  accountNames?: Map<string, string>
}

export function TransactionsTable({ transactions, page, pageSize, onPageChange, onVoid, onEdit, onDelete, accountNames }: TransactionsTableProps) {
  const nameOf = (id?: string) => (id ? accountNames?.get(id) ?? 'Unknown account' : '')
  const pageCount = Math.max(1, Math.ceil(transactions.length / pageSize))
  const pageItems = transactions.slice((page - 1) * pageSize, page * pageSize)
  // Phones: tapping a row reveals its actions (there is no hover on touch screens).
  const [openId, setOpenId] = useState<string | null>(null)
  // The category the user actually saved (e.g. Salary), not just the closest built-in one.
  const categoryLabel = (item: Transaction) => (item.category === 'other' && item.rawCategory ? item.rawCategory : CATEGORY_META[item.category].label)

  return (
    <Card>
      {transactions.length === 0 ? (
        <EmptyState icon={<Receipt size={20} />} title="No transactions found" description="Try adjusting your search or filters." />
      ) : (
        <>
          {/* Phones: a list that fits the screen — no sideways scrolling. */}
          <ul className="-mx-1 divide-y divide-border-soft sm:hidden">
            {pageItems.map((item) => {
              const meta = CATEGORY_META[item.category]
              const Icon = item.type === 'transfer' ? ArrowLeftRight : meta.icon
              const signedAmount = item.type === 'expense' ? -item.amount : item.amount
              const open = openId === item.id
              const where = item.type === 'transfer' ? `${nameOf(item.accountId)} → ${nameOf(item.toAccountId)}` : [item.payment !== 'Other' ? item.payment : '', nameOf(item.accountId)].filter(Boolean).join(' · ')
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : item.id)}
                    aria-expanded={open}
                    className={cn('flex w-full items-center gap-3 rounded-sm px-1 py-3 text-left transition-colors', open && 'bg-bg-soft')}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: meta.bg, color: meta.color }}>
                      <Icon size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-ink">{item.description}</span>
                      <span className="block truncate text-[11px] text-ink-muted">
                        {categoryLabel(item)} · {formatDate(item.date)}
                        {where && ` · ${where}`}
                      </span>
                    </span>
                    <span
                      className={cn('shrink-0 font-mono-figure text-[13px] font-semibold', item.type === 'transfer' ? 'text-ink-soft' : signedAmount < 0 ? 'text-ink' : 'text-success')}
                    >
                      {item.type === 'transfer' ? formatCurrency(item.amount) : formatCurrency(signedAmount, { signed: true })}
                    </span>
                  </button>
                  {open && item.sourceId && (
                    <div className="flex gap-2 px-1 pb-3">
                      <button type="button" onClick={() => onEdit(item)} className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-btn border border-border text-xs text-ink">
                        <Pencil size={14} /> Edit
                      </button>
                      <button type="button" onClick={() => onVoid(item)} className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-btn border border-border text-xs text-warning">
                        <Ban size={14} /> Void
                      </button>
                      <button type="button" onClick={() => onDelete(item)} className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-btn border border-danger/30 text-xs text-danger">
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>

          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[600px] border-collapse text-sm">
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
                        {categoryLabel(item)}
                      </td>
                      <td className="py-2.5 pr-3 text-xs font-medium text-ink">{item.description}</td>
                      <td className="py-2.5 pr-3 text-xs capitalize text-ink-soft">{item.type}</td>
                      <td className="py-2.5 pr-3 font-mono-figure text-xs text-ink-muted">{formatDate(item.date)}</td>
                      <td className="py-2.5 pr-3 text-xs text-ink-soft">
                        {item.type === 'transfer' ? (
                          <span className="text-ink">
                            {nameOf(item.accountId)} → {nameOf(item.toAccountId)}
                          </span>
                        ) : (
                          <>
                            {item.payment}
                            {item.accountId && <span className="block text-[10.5px] text-ink-muted">{nameOf(item.accountId)}</span>}
                          </>
                        )}
                      </td>
                      <td
                        className={cn(
                          'py-2.5 pr-2 text-right font-mono-figure text-xs font-bold',
                          item.type === 'transfer' ? 'font-semibold text-ink-soft' : signedAmount < 0 ? 'text-ink' : 'text-success',
                        )}
                      >
                        {item.type === 'transfer' ? formatCurrency(item.amount) : formatCurrency(signedAmount, { signed: true })}
                      </td>
                      <td className="py-2.5 pl-2 pr-2 text-right">
                        {item.sourceId && (
                          <div className="flex items-center justify-end gap-0.5 pointer-fine:opacity-0 transition-opacity pointer-fine:group-hover:opacity-100 group-focus-within:opacity-100">
                            <button
                              type="button"
                              onClick={() => onEdit(item)}
                              aria-label={`Edit ${item.description}`}
                              className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-card hover:text-ink"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => onVoid(item)}
                              aria-label={`Void ${item.description}`}
                              title="Void (reversible in the sheet)"
                              className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-warning-soft hover:text-warning"
                            >
                              <Ban size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDelete(item)}
                              aria-label={`Delete ${item.description} permanently`}
                              title="Delete permanently"
                              className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-danger-soft hover:text-danger"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
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
