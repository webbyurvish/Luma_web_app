import { Fragment, useState } from 'react'
import { ChevronRight, HandCoins, Pencil, Trash2, Undo2 } from 'lucide-react'
import { Badge, type BadgeVariant } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency } from '@/lib/formatCurrency'
import { formatDate } from '@/lib/formatDate'
import { cn } from '@/lib/cn'
import type { UdhaarEntry, UdhaarPerson, UdhaarStatus } from '@/types'

export const UDHAAR_STATUS: Record<UdhaarStatus, { label: string; variant: BadgeVariant }> = {
  'due-soon': { label: 'Due soon', variant: 'warning' },
  overdue: { label: 'Overdue', variant: 'danger' },
  pending: { label: 'Pending', variant: 'info' },
  settled: { label: 'Settled', variant: 'success' },
}

interface UdhaarTableProps {
  people: UdhaarPerson[]
  onAddRepayment: (person: UdhaarPerson) => void
  onEditEntry: (entry: UdhaarEntry) => void
  onDeleteEntry: (entry: UdhaarEntry) => void
}

/** One row per person; click to expand their individual Given/Repayment entries, each editable and deletable. */
export function UdhaarTable({ people, onAddRepayment, onEditEntry, onDeleteEntry }: UdhaarTableProps) {
  const [expanded, setExpanded] = useState<string | null>(null)

  if (people.length === 0) {
    return <EmptyState icon={<HandCoins size={20} />} title="No udhaar yet" description="Money you give someone will show up here." />
  }

  return (
    <>
    {/* Phones: one card per person; tap to see entries and act on them. */}
    <ul className="space-y-2 sm:hidden">
      {people.map((person) => {
        const status = UDHAAR_STATUS[person.status]
        const isOpen = expanded === person.id
        return (
          <li key={person.id} className={cn('rounded-card border border-border-soft', isOpen && 'border-border bg-bg-soft/40')}>
            <button type="button" aria-expanded={isOpen} onClick={() => setExpanded(isOpen ? null : person.id)} className="flex w-full items-center gap-3 px-3 py-3 text-left">
              <Avatar name={person.name} size={34} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-ink">{person.name}</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-muted">
                  <Badge variant={status.variant}>{status.label}</Badge>
                  {person.dueDate && <span>Due {formatDate(person.dueDate)}</span>}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-mono-figure text-[14px] font-bold text-ink">{formatCurrency(person.outstanding)}</span>
                <span className="block text-[10.5px] text-ink-muted">outstanding</span>
              </span>
            </button>
            {isOpen && (
              <div className="border-t border-border-soft px-3 pb-3 pt-2">
                <p className="mb-1 text-[11px] text-ink-muted">
                  Given {formatCurrency(person.given)} · Repaid {formatCurrency(person.repaid)}
                </p>
                <ul className="divide-y divide-border-soft">
                  {person.entries.map((entry) => (
                    <li key={entry.id} className="flex items-center gap-2 py-2">
                      <span className="min-w-0 flex-1 text-[11.5px] text-ink-soft">
                        <span className={cn('mr-1.5 font-semibold uppercase tracking-[0.05em]', entry.type === 'given' ? 'text-ink' : 'text-success')}>
                          {entry.type === 'given' ? 'Given' : 'Repaid'}
                        </span>
                        {formatDate(entry.date)}
                        {entry.description && <span className="block truncate text-ink-muted">{entry.description}</span>}
                      </span>
                      <span className={cn('shrink-0 font-mono-figure text-[12px] font-semibold', entry.type === 'given' ? 'text-ink' : 'text-success')}>
                        {entry.type === 'given' ? '' : '−'}
                        {formatCurrency(entry.amount)}
                      </span>
                      <button type="button" onClick={() => onEditEntry(entry)} aria-label={`Edit ${entry.type} entry of ${formatCurrency(entry.amount)}`} className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted hover:bg-card hover:text-ink">
                        <Pencil size={14} />
                      </button>
                      <button type="button" onClick={() => onDeleteEntry(entry)} aria-label={`Delete ${entry.type} entry of ${formatCurrency(entry.amount)}`} className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted hover:bg-danger-soft hover:text-danger">
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
                {person.outstanding > 0 && (
                  <button type="button" onClick={() => onAddRepayment(person)} className="mt-2 flex h-10 w-full items-center justify-center gap-1.5 rounded-btn border border-success/30 text-xs font-medium text-success">
                    <Undo2 size={14} /> Record repayment
                  </button>
                )}
              </div>
            )}
          </li>
        )
      })}
    </ul>

    <div className="hidden overflow-x-auto sm:block">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
            <th className="py-2 pl-2 pr-3 font-semibold">Person</th>
            <th className="py-2 pr-3 text-right font-semibold">Given</th>
            <th className="py-2 pr-3 text-right font-semibold">Repaid</th>
            <th className="py-2 pr-3 text-right font-semibold">Outstanding</th>
            <th className="py-2 pr-3 font-semibold">Due date</th>
            <th className="py-2 pr-3 font-semibold">Status</th>
            <th className="py-2 pr-2" aria-hidden="true" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border-soft">
          {people.map((person) => {
            const status = UDHAAR_STATUS[person.status]
            const isOpen = expanded === person.id
            return (
              <Fragment key={person.id}>
                <tr
                  className={cn('group cursor-pointer transition-colors hover:bg-ink/[0.04]', isOpen && 'bg-ink/[0.03]')}
                  onClick={() => setExpanded(isOpen ? null : person.id)}
                >
                  <td className="py-2.5 pl-2 pr-3">
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-label={`${isOpen ? 'Hide' : 'Show'} entries for ${person.name}`}
                      className="flex items-center gap-2.5 text-left"
                    >
                      <ChevronRight size={13} className={cn('shrink-0 text-ink-muted transition-transform', isOpen && 'rotate-90')} />
                      <Avatar name={person.name} size={26} />
                      <span className="text-xs font-medium text-ink">{person.name}</span>
                      <span className="text-[10px] text-ink-muted">{person.entries.length}</span>
                    </button>
                  </td>
                  <td className="py-2.5 pr-3 text-right font-mono-figure text-xs text-ink-soft">{formatCurrency(person.given)}</td>
                  <td className="py-2.5 pr-3 text-right font-mono-figure text-xs text-ink-soft">{formatCurrency(person.repaid)}</td>
                  <td className="py-2.5 pr-3 text-right font-mono-figure text-xs font-bold text-ink">{formatCurrency(person.outstanding)}</td>
                  <td className="py-2.5 pr-3 font-mono-figure text-xs text-ink-muted">{person.dueDate ? formatDate(person.dueDate) : '—'}</td>
                  <td className="py-2.5 pr-3">
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </td>
                  <td className="py-2.5 pr-2 text-right">
                    {person.outstanding > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onAddRepayment(person)
                        }}
                        title="Record a repayment"
                        aria-label={`Record a repayment from ${person.name}`}
                        className="rounded-full p-1.5 text-ink-muted pointer-fine:opacity-0 transition-colors hover:bg-success-soft hover:text-success pointer-fine:group-hover:opacity-100 focus-visible:opacity-100"
                      >
                        <Undo2 size={13} />
                      </button>
                    )}
                  </td>
                </tr>

                {isOpen &&
                  person.entries.map((entry) => (
                    <tr key={entry.id} className="group/entry bg-bg-soft/50">
                      <td className="py-2 pl-12 pr-3 text-[11px] text-ink-soft" colSpan={3}>
                        <span className={cn('mr-2 font-semibold uppercase tracking-[0.05em]', entry.type === 'given' ? 'text-ink' : 'text-success')}>
                          {entry.type === 'given' ? 'Given' : 'Repaid'}
                        </span>
                        {formatDate(entry.date)}
                        {entry.description && <span className="text-ink-muted"> · {entry.description}</span>}
                      </td>
                      <td
                        className={cn(
                          'py-2 pr-3 text-right font-mono-figure text-[11px] font-semibold',
                          entry.type === 'given' ? 'text-ink' : 'text-success',
                        )}
                      >
                        {entry.type === 'given' ? '' : '−'}
                        {formatCurrency(entry.amount)}
                      </td>
                      <td className="py-2 pr-3 font-mono-figure text-[11px] text-ink-muted">{entry.dueDate ? `Due ${formatDate(entry.dueDate)}` : ''}</td>
                      <td className="py-2 pr-2 text-right" colSpan={2}>
                        <div className="flex items-center justify-end gap-0.5 transition-opacity pointer-fine:opacity-0 pointer-fine:group-hover/entry:opacity-100 group-focus-within/entry:opacity-100">
                          <button
                            type="button"
                            onClick={() => onEditEntry(entry)}
                            aria-label={`Edit ${entry.type} entry of ${formatCurrency(entry.amount)}`}
                            className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-card hover:text-ink"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteEntry(entry)}
                            aria-label={`Delete ${entry.type} entry of ${formatCurrency(entry.amount)} permanently`}
                            title="Delete permanently"
                            className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-danger-soft hover:text-danger"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
    </>
  )
}
