import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarClock, CheckCircle2, Pencil, Plus, Receipt, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { DeleteRecordDialog } from '@/components/ui/DeleteRecordDialog'
import { ListSkeleton } from '@/components/ui/Skeleton'
import { SyncBar } from '@/components/ui/Loader'
import { AccountSelect } from '@/components/finance/AccountSelect'
import { BillEditor } from './BillEditor'
import { useBills } from '@/hooks/usePlanning'
import { useAccounts } from '@/hooks/useFinanceCollections'
import { useTransactions } from '@/hooks/useTransactions'
import { useToast } from '@/context/ToastContext'
import { accountsForMethod, previewBalanceChanges } from '@/lib/accountLinking'
import { billStatus, dueLabel, monthlyBillTotal, type BillState } from '@/lib/planning'
import { formatCurrency } from '@/lib/formatCurrency'
import { formatDate, todayIstDateKey } from '@/lib/formatDate'
import { getErrorMessage } from '@/lib/errors'
import { cn } from '@/lib/cn'
import type { Bill, BillInput, FinancialAccount } from '@/types'

const GROUPS: { state: BillState[]; title: string }[] = [
  { state: ['overdue'], title: 'Overdue' },
  { state: ['today', 'soon'], title: 'Due soon' },
  { state: ['later'], title: 'Later' },
  { state: ['paused'], title: 'Paused' },
]

const CHIP: Record<BillState, string> = {
  overdue: 'bg-danger-soft text-danger',
  today: 'bg-warning-soft text-ink',
  soon: 'bg-warning-soft text-ink',
  later: 'bg-bg-soft text-ink-soft',
  paused: 'bg-bg-soft text-ink-muted',
}

export function BillsSection() {
  const { showToast } = useToast()
  const { bills, loading, refreshing, error, refetch, createBill, creating, updateBill, updating, deleteBill, deleting, payBill, paying } = useBills()
  const { accounts } = useAccounts()
  const { transactions } = useTransactions()
  const today = todayIstDateKey()

  const [editor, setEditor] = useState<Bill | 'new' | null>(null)
  const [payTarget, setPayTarget] = useState<Bill | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Bill | null>(null)

  const categories = useMemo(() => [...new Set(transactions.map((t) => t.rawCategory ?? '').filter(Boolean))], [transactions])
  const withStatus = useMemo(
    () => bills.map((bill) => ({ bill, ...billStatus(bill, today) })).sort((a, b) => (a.bill.nextDueDate < b.bill.nextDueDate ? -1 : 1)),
    [bills, today],
  )
  const overdue = withStatus.filter((b) => b.state === 'overdue')
  const dueWeek = withStatus.filter((b) => b.state !== 'paused' && b.days >= 0 && b.days <= 7)
  const accountName = (id?: string) => accounts.find((a) => a.id === id)?.name

  const save = async (input: BillInput) => {
    try {
      if (editor && editor !== 'new') {
        await updateBill(editor.id, input)
        showToast('Bill updated')
      } else {
        await createBill(input)
        showToast(`${input.name} added — you'll be reminded before it's due`)
      }
      setEditor(null)
    } catch (err) {
      showToast(getErrorMessage(err, "Couldn't save the bill."), 'error')
    }
  }

  if (loading) return <ListSkeleton rows={4} />
  if (error && !bills.length) return <ErrorState title="Couldn't load your bills" description={error} onRetry={() => void refetch()} />

  return (
    <div className="relative space-y-4">
      <SyncBar active={refreshing} className="rounded-none" />
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Bills per month" value={formatCurrency(monthlyBillTotal(bills))} hint={`${bills.filter((b) => b.isActive).length} active bills`} />
        <Stat label="Due in the next 7 days" value={formatCurrency(dueWeek.reduce((s, b) => s + b.bill.amount, 0))} hint={`${dueWeek.length} bill${dueWeek.length === 1 ? '' : 's'}`} />
        <Stat
          label="Overdue"
          value={formatCurrency(overdue.reduce((s, b) => s + b.bill.amount, 0))}
          hint={overdue.length ? `${overdue.length} need paying` : 'All caught up'}
          tone={overdue.length ? 'danger' : 'ok'}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-ink-soft">Mark a bill paid and Luma records the expense, updates the account and moves it to the next due date.</p>
        <Button size="sm" icon={<Plus size={13} />} onClick={() => setEditor('new')}>
          Add bill
        </Button>
      </div>

      {!bills.length ? (
        <EmptyState
          icon={<Receipt size={20} />}
          title="No recurring bills yet"
          description="Add rent, EMIs, subscriptions, insurance premiums or school fees — Luma reminds you before each one is due."
          action={
            <Button size="sm" icon={<Plus size={13} />} onClick={() => setEditor('new')}>
              Add your first bill
            </Button>
          }
        />
      ) : (
        GROUPS.map((group) => {
          const rows = withStatus.filter((b) => group.state.includes(b.state))
          if (!rows.length) return null
          return (
            <Card key={group.title} className="p-0">
              <p className="border-b border-border-soft px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
                {group.title} · {rows.length}
              </p>
              <ul className="divide-y divide-border-soft">
                {rows.map(({ bill, state, days }) => (
                  <li key={bill.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', state === 'overdue' ? 'bg-danger-soft text-danger' : 'bg-bg-soft text-ink-soft')}>
                      {state === 'overdue' ? <AlertTriangle size={15} /> : <CalendarClock size={15} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-ink">{bill.name}</p>
                      <p className="truncate text-[11px] text-ink-muted">
                        {bill.frequency} · {bill.category}
                        {bill.paymentMethod && ` · ${bill.paymentMethod}`}
                        {accountName(bill.accountId) && ` · ${accountName(bill.accountId)}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono-figure text-[13px] font-semibold text-ink">{formatCurrency(bill.amount)}</p>
                      <span className={cn('mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium', CHIP[state])}>
                        {state === 'paused' ? 'Paused' : `${dueLabel(days)} · ${formatDate(bill.nextDueDate)}`}
                      </span>
                    </div>
                    <div className="flex w-full items-center justify-end gap-1 sm:w-auto">
                      {state !== 'paused' && (
                        <Button size="sm" variant={state === 'later' ? 'secondary' : 'primary'} icon={<CheckCircle2 size={13} />} onClick={() => setPayTarget(bill)}>
                          Mark paid
                        </Button>
                      )}
                      <button type="button" onClick={() => setEditor(bill)} aria-label={`Edit ${bill.name}`} className="rounded-full p-2 text-ink-muted hover:bg-bg-soft hover:text-ink">
                        <Pencil size={14} />
                      </button>
                      <button type="button" onClick={() => setDeleteTarget(bill)} aria-label={`Delete ${bill.name}`} className="rounded-full p-2 text-ink-muted hover:bg-danger-soft hover:text-danger">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )
        })
      )}

      <BillEditor
        open={editor !== null}
        bill={editor === 'new' ? null : editor}
        accounts={accounts}
        categories={categories}
        onClose={() => setEditor(null)}
        onSave={(input) => void save(input)}
        saving={creating || updating}
      />
      <PayBillDialog
        bill={payTarget}
        accounts={accounts}
        today={today}
        paying={paying}
        onClose={() => setPayTarget(null)}
        onPay={async (details) => {
          if (!payTarget) return
          try {
            await payBill(payTarget.id, { dueDate: payTarget.nextDueDate, ...details })
            showToast(payTarget.frequency === 'One-time' ? `${payTarget.name} paid` : `${payTarget.name} paid — next one is set`)
            setPayTarget(null)
          } catch (err) {
            showToast(getErrorMessage(err, "Couldn't mark the bill paid."), 'error')
            if (err && typeof err === 'object' && 'alreadyPaid' in err && err.alreadyPaid) setPayTarget(null)
          }
        }}
      />
      <DeleteRecordDialog
        open={deleteTarget !== null}
        recordType="bill"
        recordName={deleteTarget?.name}
        loading={deleting}
        onConfirm={async () => {
          if (!deleteTarget) return
          try {
            await deleteBill(deleteTarget.id)
            showToast('Bill deleted')
            setDeleteTarget(null)
          } catch (err) {
            showToast(getErrorMessage(err, "Couldn't delete the bill."), 'error')
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )

}

function PayBillDialog({
  bill,
  accounts,
  today,
  paying: busy,
  onClose,
  onPay,
}: {
  bill: Bill | null
  accounts: FinancialAccount[]
  today: string
  paying: boolean
  onClose: () => void
  onPay: (details: { amount: number; date: string; accountId?: string; paymentMethod?: string }) => Promise<void>
}) {
  const [amountText, setAmountText] = useState('')
  const [date, setDate] = useState(today)
  const [accountId, setAccountId] = useState('')

  useEffect(() => {
    if (!bill) return
    setAmountText(String(bill.amount))
    setDate(today)
    setAccountId(bill.accountId ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bill])

  if (!bill) return <Modal open={false} onClose={onClose} title="">{null}</Modal>
  const amount = Number(amountText)
  const { suggested, others } = accountsForMethod(accounts.filter((a) => a.isActive), bill.paymentMethod)
  const change = accountId ? previewBalanceChanges(accounts, { kind: 'expense', amount: amount || 0, accountId })[0] : undefined
  return (
    <Modal open onClose={onClose} busy={busy} title={`Pay ${bill.name}`} subtitle={`Due ${formatDate(bill.nextDueDate)} · ${bill.frequency}`}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="mb-1.5 text-xs font-medium text-ink-soft">Amount paid (₹)</p>
            <Input value={amountText} onChange={(e) => setAmountText(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" className="font-mono-figure" />
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-ink-soft">Paid on</p>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} max={today} />
          </div>
        </div>
        <AccountSelect label="Paid from" value={accountId} onChange={setAccountId} suggested={suggested} others={others} change={change} />
        <p className="text-[11px] leading-relaxed text-ink-muted">
          Records a {formatCurrency(amount || 0)} expense in {bill.category}
          {bill.frequency === 'One-time' ? ' and closes this bill.' : ' and moves the bill to its next due date.'}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button size="sm" icon={<CheckCircle2 size={13} />} loading={busy} loadingText="Recording…" disabled={!(amount > 0) || !date} onClick={() => void onPay({ amount, date, accountId, paymentMethod: bill.paymentMethod })}>
            Mark paid
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: 'danger' | 'ok' }) {
  return (
    <Card className="px-4 py-3.5">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-muted">{label}</p>
      <p className={cn('mt-1 font-mono-figure text-xl font-semibold', tone === 'danger' ? 'text-danger' : 'text-ink')}>{value}</p>
      <p className={cn('mt-0.5 text-[11px]', tone === 'ok' ? 'text-success' : 'text-ink-muted')}>{hint}</p>
    </Card>
  )
}
