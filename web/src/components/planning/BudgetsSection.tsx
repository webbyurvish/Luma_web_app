import { useEffect, useId, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Pencil, PiggyBank, Plus, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { ThemedSelect } from '@/components/ui/ThemedSelect'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { DeleteRecordDialog } from '@/components/ui/DeleteRecordDialog'
import { ListSkeleton } from '@/components/ui/Skeleton'
import { SyncBar } from '@/components/ui/Loader'
import { useBudgets } from '@/hooks/usePlanning'
import { useTransactions } from '@/hooks/useTransactions'
import { useToast } from '@/context/ToastContext'
import { budgetUsage } from '@/lib/planning'
import { formatCurrency } from '@/lib/formatCurrency'
import { MONTH_ABBR, todayIstDateKey } from '@/lib/formatDate'
import { getErrorMessage } from '@/lib/errors'
import { cn } from '@/lib/cn'
import type { Budget, BudgetInput } from '@/types'

const ALERTS = [50, 60, 70, 75, 80, 85, 90, 100]

function shiftMonth(month: string, by: number): string {
  const d = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + by, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const monthLabel = (month: string) => `${MONTH_ABBR[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`

export function BudgetsSection() {
  const { showToast } = useToast()
  const { budgets, loading, refreshing, error, refetch, createBudget, creating, updateBudget, updating, deleteBudget, deleting } = useBudgets()
  const { transactions } = useTransactions()
  const thisMonth = todayIstDateKey().slice(0, 7)
  const [month, setMonth] = useState(thisMonth)
  const [editor, setEditor] = useState<{ budget: Budget | null; preset?: { category: string; limit: number } } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Budget | null>(null)

  const usage = useMemo(() => budgetUsage(budgets, transactions, month), [budgets, transactions, month])
  const totals = usage.reduce((acc, u) => ({ limit: acc.limit + u.budget.monthlyLimit, spent: acc.spent + u.spent }), { limit: 0, spent: 0 })

  // Where money went this month without a budget — the obvious next budgets to set.
  const unbudgeted = useMemo(() => {
    const covered = new Set(budgets.map((b) => b.category.trim().toLowerCase()))
    const sums = new Map<string, number>()
    transactions.forEach((t) => {
      if (t.type !== 'expense' || !t.date.startsWith(month)) return
      const name = (t.rawCategory ?? t.category).trim()
      if (!name || covered.has(name.toLowerCase())) return
      sums.set(name, (sums.get(name) ?? 0) + t.amount)
    })
    return [...sums.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [budgets, transactions, month])

  const categories = useMemo(() => [...new Set(transactions.filter((t) => t.type === 'expense').map((t) => (t.rawCategory ?? t.category).trim()).filter(Boolean))], [transactions])

  const save = async (input: BudgetInput) => {
    try {
      if (editor?.budget) {
        await updateBudget(editor.budget.id, input)
        showToast('Budget updated')
      } else {
        await createBudget(input)
        showToast(`Budget set for ${input.category}`)
      }
      setEditor(null)
    } catch (err) {
      showToast(getErrorMessage(err, "Couldn't save the budget."), 'error')
    }
  }

  if (loading) return <ListSkeleton rows={4} />
  if (error && !budgets.length) return <ErrorState title="Couldn't load your budgets" description={error} onRetry={() => void refetch()} />

  const overall = totals.limit ? totals.spent / totals.limit : 0
  return (
    <div className="relative space-y-4">
      <SyncBar active={refreshing} className="rounded-none" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-full border border-border bg-card p-0.5">
          <button type="button" onClick={() => setMonth((m) => shiftMonth(m, -1))} aria-label="Previous month" className="rounded-full p-1.5 text-ink-muted hover:bg-bg-soft hover:text-ink">
            <ChevronLeft size={14} />
          </button>
          <span className="min-w-[78px] text-center text-xs font-medium text-ink">{monthLabel(month)}</span>
          <button
            type="button"
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            disabled={month >= thisMonth}
            aria-label="Next month"
            className="rounded-full p-1.5 text-ink-muted hover:bg-bg-soft hover:text-ink disabled:opacity-30"
          >
            <ChevronRight size={14} />
          </button>
        </div>
        <Button size="sm" icon={<Plus size={13} />} onClick={() => setEditor({ budget: null })}>
          Add budget
        </Button>
      </div>

      {!budgets.length ? (
        <EmptyState
          icon={<PiggyBank size={20} />}
          title="No budgets yet"
          description="Set a monthly limit for categories like Food or Shopping. Luma warns you as you get close."
          action={
            <Button size="sm" icon={<Plus size={13} />} onClick={() => setEditor({ budget: null })}>
              Set your first budget
            </Button>
          }
        />
      ) : (
        <>
          <Card className="px-5 py-4">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Spent in budgeted categories</p>
                <p className="mt-1 font-mono-figure text-2xl font-semibold text-ink">
                  {formatCurrency(totals.spent)} <span className="text-sm font-normal text-ink-muted">of {formatCurrency(totals.limit)}</span>
                </p>
              </div>
              <p className={cn('text-xs font-medium', totals.spent > totals.limit ? 'text-danger' : 'text-success')}>
                {totals.spent > totals.limit ? `${formatCurrency(totals.spent - totals.limit)} over` : `${formatCurrency(totals.limit - totals.spent)} left`}
              </p>
            </div>
            <Bar ratio={overall} state={overall >= 1 ? 'over' : overall >= 0.8 ? 'warn' : 'ok'} className="mt-3 h-2.5" />
          </Card>

          <div className="grid gap-3 md:grid-cols-2">
            {usage.map((u) => (
              <Card key={u.budget.id} className="group px-4 py-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-ink">{u.budget.category}</p>
                    <p className="mt-0.5 text-[11px] text-ink-muted">
                      <span className="font-mono-figure text-ink-soft">{formatCurrency(u.spent)}</span> of {formatCurrency(u.budget.monthlyLimit)} · alert at {u.budget.alertAtPercent}%
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5 pointer-fine:opacity-70 transition-opacity pointer-fine:group-hover:opacity-100">
                    <button type="button" onClick={() => setEditor({ budget: u.budget })} aria-label={`Edit ${u.budget.category} budget`} className="rounded-full p-1.5 text-ink-muted hover:bg-bg-soft hover:text-ink">
                      <Pencil size={13} />
                    </button>
                    <button type="button" onClick={() => setDeleteTarget(u.budget)} aria-label={`Delete ${u.budget.category} budget`} className="rounded-full p-1.5 text-ink-muted hover:bg-danger-soft hover:text-danger">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <Bar ratio={u.ratio} state={u.state} className="mt-3" />
                <p className={cn('mt-1.5 text-[11px]', u.state === 'over' ? 'text-danger' : u.state === 'warn' ? 'text-warning' : 'text-ink-muted')}>
                  {u.state === 'over' ? `${formatCurrency(-u.left)} over budget` : `${formatCurrency(u.left)} left · ${Math.round(u.ratio * 100)}% used`}
                </p>
              </Card>
            ))}
          </div>
          {budgets.some((b) => !b.isActive) && <p className="text-[11px] text-ink-muted">{budgets.filter((b) => !b.isActive).length} paused budget(s) are hidden.</p>}
        </>
      )}

      {unbudgeted.length > 0 && (
        <Card className="px-4 py-3.5">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Not budgeted yet · {monthLabel(month)}</p>
          <ul className="mt-2 divide-y divide-border-soft">
            {unbudgeted.map(([category, spent]) => (
              <li key={category} className="flex items-center justify-between gap-2 py-2">
                <span className="text-xs text-ink">{category}</span>
                <span className="flex items-center gap-2">
                  <span className="font-mono-figure text-xs text-ink-soft">{formatCurrency(spent)}</span>
                  <Button size="sm" variant="ghost" onClick={() => setEditor({ budget: null, preset: { category, limit: Math.ceil((spent * 1.1) / 500) * 500 } })}>
                    Set budget
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <BudgetEditor
        open={editor !== null}
        budget={editor?.budget ?? null}
        preset={editor?.preset}
        categories={categories}
        takenCategories={budgets.filter((b) => b.id !== editor?.budget?.id).map((b) => b.category.trim().toLowerCase())}
        saving={creating || updating}
        onClose={() => setEditor(null)}
        onSave={(input) => void save(input)}
      />
      <DeleteRecordDialog
        open={deleteTarget !== null}
        recordType="budget"
        recordName={deleteTarget?.category}
        loading={deleting}
        onConfirm={async () => {
          if (!deleteTarget) return
          try {
            await deleteBudget(deleteTarget.id)
            showToast('Budget deleted')
            setDeleteTarget(null)
          } catch (err) {
            showToast(getErrorMessage(err, "Couldn't delete the budget."), 'error')
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

function Bar({ ratio, state, className }: { ratio: number; state: 'ok' | 'warn' | 'over'; className?: string }) {
  return (
    <div className={cn('h-2 overflow-hidden rounded-full bg-bg-soft', className)} role="progressbar" aria-valuenow={Math.round(ratio * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div
        className={cn('h-full rounded-full transition-[width] duration-500', state === 'over' ? 'bg-danger' : state === 'warn' ? 'bg-warning' : 'bg-success')}
        style={{ width: `${Math.min(100, Math.round(ratio * 100))}%` }}
      />
    </div>
  )
}

function BudgetEditor({
  open,
  budget,
  preset,
  categories,
  takenCategories,
  saving,
  onClose,
  onSave,
}: {
  open: boolean
  budget: Budget | null
  preset?: { category: string; limit: number }
  categories: string[]
  takenCategories: string[]
  saving: boolean
  onClose: () => void
  onSave: (input: BudgetInput) => void
}) {
  const listId = useId()
  const [category, setCategory] = useState('')
  const [limitText, setLimitText] = useState('')
  const [alert, setAlert] = useState(80)
  const [notes, setNotes] = useState('')
  const [active, setActive] = useState(true)
  const [attempted, setAttempted] = useState(false)

  useEffect(() => {
    if (!open) return
    setCategory(budget?.category ?? preset?.category ?? '')
    setLimitText(budget ? String(budget.monthlyLimit) : preset ? String(preset.limit) : '')
    setAlert(budget?.alertAtPercent ?? 80)
    setNotes(budget?.notes ?? '')
    setActive(budget?.isActive ?? true)
    setAttempted(false)
  }, [open, budget, preset])

  const limit = Number(limitText)
  const errors = {
    category: !category.trim() ? 'Choose a category.' : takenCategories.includes(category.trim().toLowerCase()) ? 'There is already a budget for this category.' : '',
    limit: limit > 0 ? '' : 'Enter a monthly limit above 0.',
  }
  const submit = () => {
    setAttempted(true)
    if (errors.category || errors.limit) return
    onSave({ category: category.trim(), monthlyLimit: limit, alertAtPercent: alert, isActive: active, notes: notes.trim() })
  }

  return (
    <Modal open={open} onClose={onClose} busy={saving} title={budget ? `Edit ${budget.category} budget` : 'New monthly budget'} subtitle="Matched against the category of your expenses">
      <div className="space-y-4">
        <div>
          <p className="mb-1.5 text-xs font-medium text-ink-soft">Category</p>
          <Input list={listId} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Food" autoFocus={!budget} className={cn(attempted && errors.category && 'border-danger')} />
          <datalist id={listId}>
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          {attempted && errors.category && <p className="mt-1 text-[11px] text-danger">{errors.category}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="mb-1.5 text-xs font-medium text-ink-soft">Monthly limit (₹)</p>
            <Input value={limitText} onChange={(e) => setLimitText(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" className={cn('font-mono-figure', attempted && errors.limit && 'border-danger')} />
            {attempted && errors.limit && <p className="mt-1 text-[11px] text-danger">{errors.limit}</p>}
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-ink-soft">Warn me at</p>
            <ThemedSelect value={String(alert)} onChange={(v) => setAlert(Number(v))} options={ALERTS.map((a) => ({ value: String(a), label: `${a}% used` }))} aria-label="Warn me at" />
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-ink-soft">Notes (optional)</p>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. includes Swiggy and Zomato" />
        </div>
        {budget && (
          <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-soft">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-3.5 w-3.5 accent-rust" />
            Active (paused budgets are hidden and never warn)
          </label>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} loading={saving} loadingText="Saving…">
            {budget ? 'Save changes' : 'Set budget'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
