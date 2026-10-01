import { useEffect, useId, useState } from 'react'
import { SlideOver } from '@/components/ui/SlideOver'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ThemedSelect } from '@/components/ui/ThemedSelect'
import { Switch } from '@/components/ui/Switch'
import { AccountSelect } from '@/components/finance/AccountSelect'
import { accountsForMethod, defaultAccountFor } from '@/lib/accountLinking'
import { BILL_FREQUENCIES } from '@/lib/planning'
import { todayIstDateKey } from '@/lib/formatDate'
import { cn } from '@/lib/cn'
import type { Bill, BillFrequency, BillInput, FinancialAccount } from '@/types'

const METHODS = ['UPI', 'Auto-debit', 'Card', 'Net Banking', 'Bank Transfer', 'Cash']
const REMIND = [0, 1, 2, 3, 5, 7, 10, 15]
const SUGGESTED_CATEGORIES = ['Bills', 'Home', 'Rent', 'EMI', 'Insurance', 'Subscriptions', 'Utilities', 'Education', 'Health', 'Transport']

function toForm(bill: Bill | null): BillInput {
  if (!bill) return { name: '', amount: 0, category: 'Bills', paymentMethod: 'UPI', accountId: '', frequency: 'Monthly', nextDueDate: todayIstDateKey(), remindDaysBefore: 3, isActive: true, notes: '' }
  return {
    name: bill.name,
    amount: bill.amount,
    category: bill.category,
    paymentMethod: bill.paymentMethod,
    accountId: bill.accountId ?? '',
    frequency: bill.frequency,
    nextDueDate: bill.nextDueDate,
    remindDaysBefore: bill.remindDaysBefore,
    isActive: bill.isActive,
    notes: bill.notes ?? '',
  }
}

interface BillEditorProps {
  open: boolean
  bill: Bill | null
  accounts: FinancialAccount[]
  categories: string[]
  onClose: () => void
  onSave: (input: BillInput) => void
  saving?: boolean
}

export function BillEditor({ open, bill, accounts, categories, onClose, onSave, saving }: BillEditorProps) {
  const [form, setForm] = useState<BillInput>(() => toForm(null))
  const [amountText, setAmountText] = useState('')
  const [initial, setInitial] = useState('')
  const [attempted, setAttempted] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [accountTouched, setAccountTouched] = useState(false)
  const listId = useId()

  useEffect(() => {
    if (!open) return
    const next = toForm(bill)
    if (!bill) next.accountId = defaultAccountFor(accounts, next.paymentMethod)
    setForm(next)
    setAmountText(bill ? String(bill.amount) : '')
    setInitial(JSON.stringify({ ...next, amount: bill ? bill.amount : 0 }))
    setAttempted(false)
    setAccountTouched(!!bill)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, bill])

  const amount = Number(amountText)
  const current = { ...form, amount: Number.isFinite(amount) ? amount : 0 }
  const dirty = JSON.stringify(current) !== initial
  const errors = {
    name: form.name.trim() ? '' : 'Give the bill a name.',
    amount: amountText.trim() && amount > 0 ? '' : 'Enter an amount above 0.',
    date: /^\d{4}-\d{2}-\d{2}$/.test(form.nextDueDate) ? '' : 'Pick the next due date.',
  }
  const valid = !errors.name && !errors.amount && !errors.date
  const set = <K extends keyof BillInput>(key: K, value: BillInput[K]) => setForm((f) => ({ ...f, [key]: value }))
  const { suggested, others } = accountsForMethod(accounts.filter((a) => a.isActive), form.paymentMethod)

  const save = () => {
    setAttempted(true)
    if (!valid) return
    onSave({ ...current, name: form.name.trim(), category: form.category.trim() || 'Bills', notes: form.notes.trim() })
  }
  const requestClose = () => (dirty ? setConfirmDiscard(true) : onClose())

  return (
    <>
      <SlideOver
        open={open}
        onClose={requestClose}
        title={bill ? `Edit ${bill.name}` : 'New recurring bill'}
        subtitle="Rent, EMIs, subscriptions, premiums — anything you pay on a schedule"
        busy={saving}
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={requestClose}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={save} loading={saving} loadingText="Saving…" disabled={!!bill && !dirty}>
              {bill ? 'Save changes' : 'Add bill'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Field label="Name" error={attempted ? errors.name : ''}>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. House rent, Netflix, Car EMI" autoFocus={!bill} className={cn(attempted && errors.name && 'border-danger')} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount (₹)" error={attempted ? errors.amount : ''}>
              <Input value={amountText} onChange={(e) => setAmountText(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder="0" className={cn('font-mono-figure', attempted && errors.amount && 'border-danger')} />
            </Field>
            <Field label="Repeats">
              <ThemedSelect value={form.frequency} onChange={(v) => set('frequency', v as BillFrequency)} options={BILL_FREQUENCIES.map((f) => ({ value: f, label: f }))} aria-label="Repeats" />
            </Field>
            <Field label={form.frequency === 'One-time' ? 'Due on' : 'Next due date'} error={attempted ? errors.date : ''}>
              <Input type="date" value={form.nextDueDate} onChange={(e) => set('nextDueDate', e.target.value)} />
            </Field>
            <Field label="Remind me">
              <ThemedSelect
                value={String(form.remindDaysBefore)}
                onChange={(v) => set('remindDaysBefore', Number(v))}
                options={REMIND.map((d) => ({ value: String(d), label: d === 0 ? 'On the day' : `${d} day${d > 1 ? 's' : ''} before` }))}
                aria-label="Remind me"
              />
            </Field>
          </div>
          <Field label="Paid by">
            <div className="flex flex-wrap gap-1.5">
              {METHODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    set('paymentMethod', m)
                    if (!accountTouched) set('accountId', defaultAccountFor(accounts, m))
                  }}
                  aria-pressed={form.paymentMethod === m}
                  className={cn(
                    'rounded-full border px-3 py-1 text-[11.5px] transition-colors',
                    form.paymentMethod === m ? 'border-ink bg-ink text-paper' : 'border-border text-ink-soft hover:bg-bg-soft hover:text-ink',
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </Field>
          <AccountSelect
            label="Paid from"
            value={form.accountId}
            onChange={(id) => {
              setAccountTouched(true)
              set('accountId', id)
            }}
            suggested={suggested}
            others={others}
            hint="When you mark it paid, this account's balance goes down automatically."
          />
          <Field label="Category">
            <Input list={listId} value={form.category} onChange={(e) => set('category', e.target.value)} placeholder="Bills" />
            <datalist id={listId}>
              {[...new Set([...SUGGESTED_CATEGORIES, ...categories])].map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field label="Notes (optional)">
            <textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={2}
              placeholder="Customer ID, policy number, landlord's UPI…"
              className="w-full resize-y rounded-sm border border-border bg-surface px-3 py-2 text-xs text-ink placeholder:text-ink-muted focus:border-rust focus:outline-none"
            />
          </Field>
          {bill && <Switch checked={form.isActive} onChange={(v) => set('isActive', v)} label="Active (paused bills don't remind you)" />}
        </div>
      </SlideOver>
      <ConfirmDialog
        open={confirmDiscard}
        title="Discard changes?"
        description="Your changes to this bill haven't been saved."
        confirmLabel="Discard"
        destructive
        onConfirm={() => {
          setConfirmDiscard(false)
          onClose()
        }}
        onCancel={() => setConfirmDiscard(false)}
      />
    </>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-ink-soft">{label}</p>
      {children}
      {error && <p className="mt-1 text-[11px] text-danger">{error}</p>}
    </div>
  )
}
