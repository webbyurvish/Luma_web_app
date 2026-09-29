import { useEffect, useMemo, useState } from 'react'
import { SlideOver } from '@/components/ui/SlideOver'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ThemedSelect } from '@/components/ui/ThemedSelect'
import { CATEGORY_META } from '@/lib/categoryMeta'
import { todayIstDateKey } from '@/lib/formatDate'
import type { Transaction, TransactionUpdateInput } from '@/types'

interface FormState {
  date: string
  amount: string
  type: 'Expense' | 'Income'
  category: string
  subcategory: string
  paymentMethod: string
  merchant: string
  note: string
}

const TYPE_OPTIONS = [
  { value: 'Expense', label: 'Expense' },
  { value: 'Income', label: 'Income' },
]

const COMMON_PAYMENT_METHODS = ['UPI', 'Card', 'Cash', 'Bank Transfer', 'Net Banking']

function transactionToForm(t: Transaction): FormState {
  return {
    date: t.date,
    amount: String(t.amount),
    type: t.type === 'income' ? 'Income' : 'Expense',
    category: t.rawCategory ?? CATEGORY_META[t.category].label,
    subcategory: t.rawSubcategory ?? '',
    paymentMethod: t.payment === 'Other' ? '' : t.payment,
    merchant: t.merchant ?? '',
    note: t.note ?? '',
  }
}


function emptyForm(type: 'Expense' | 'Income'): FormState {
  return { date: todayIstDateKey(), amount: '', type, category: type === 'Income' ? 'Income' : '', subcategory: '', paymentMethod: '', merchant: '', note: '' }
}

function applyDraft(form: FormState, draft?: Partial<TransactionUpdateInput>): FormState {
  if (!draft) return form
  return {
    ...form,
    ...(draft.type === 'Expense' || draft.type === 'Income' ? { type: draft.type } : {}),
    ...(draft.date ? { date: draft.date } : {}),
    ...(draft.amount ? { amount: String(draft.amount) } : {}),
    ...(draft.category ? { category: draft.category } : {}),
    ...(draft.subcategory ? { subcategory: draft.subcategory } : {}),
    ...(draft.paymentMethod ? { paymentMethod: draft.paymentMethod } : {}),
    ...(draft.merchant ? { merchant: draft.merchant } : {}),
    ...(draft.note ? { note: draft.note } : {}),
  }
}
/** Merges fixed choices with values already used in the sheet, so free-text sheet values stay selectable. */
function toOptions(values: (string | undefined)[]): { value: string; label: string }[] {
  const unique = Array.from(new Set(values.map((v) => v?.trim()).filter((v): v is string => !!v)))
  return unique.sort((a, b) => a.localeCompare(b)).map((value) => ({ value, label: value }))
}

interface TransactionEditorProps {
  open: boolean
  /** The transaction to edit; null opens the editor in "add new" mode. */
  transaction: Transaction | null
  /** Starting type for a new transaction. */
  newType?: 'Expense' | 'Income'
  /** Pre-filled values for a new transaction (e.g. from quick-add), still reviewed before saving. */
  draft?: Partial<TransactionUpdateInput>
  /** Every loaded transaction — used to offer the categories/payment methods already in the sheet. */
  allTransactions: Transaction[]
  onClose: () => void
  /** Receives only the fields that changed, so values the app displays differently from the sheet are never rewritten. */
  onSave: (input: Partial<TransactionUpdateInput>) => void
  saving?: boolean
}

export function TransactionEditor({ open, transaction, newType = 'Expense', draft, allTransactions, onClose, onSave, saving }: TransactionEditorProps) {
  const isCreate = transaction === null
  const [form, setForm] = useState<FormState | null>(null)
  const [initialForm, setInitialForm] = useState<FormState | null>(null)
  const [attemptedSave, setAttemptedSave] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  useEffect(() => {
    if (!open) return
    const next = transaction ? transactionToForm(transaction) : applyDraft(emptyForm(newType), draft)
    setForm(next)
    setInitialForm(next)
    setAttemptedSave(false)
  }, [open, transaction, newType, draft])

  const categoryOptions = useMemo(
    () => toOptions([...Object.values(CATEGORY_META).map((m) => m.label), ...allTransactions.map((t) => t.rawCategory), form?.category]),
    [allTransactions, form?.category],
  )
  const paymentOptions = useMemo(
    () => toOptions([...COMMON_PAYMENT_METHODS, ...allTransactions.map((t) => (t.payment === 'Other' ? undefined : t.payment)), form?.paymentMethod]),
    [allTransactions, form?.paymentMethod],
  )

  if (!form) return null

  const amountNumber = Number(form.amount)
  const errors = {
    date: /^\d{4}-\d{2}-\d{2}$/.test(form.date) ? '' : 'Pick a date.',
    amount: form.amount.trim() && Number.isFinite(amountNumber) && amountNumber > 0 ? '' : 'Enter an amount above 0.',
    category: form.category.trim() ? '' : 'Category is required.',
  }
  const isValid = !errors.date && !errors.amount && !errors.category
  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm)

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => (f ? { ...f, [key]: value } : f))

  const requestClose = () => {
    if (isDirty) setConfirmDiscard(true)
    else onClose()
  }

  const handleSave = () => {
    setAttemptedSave(true)
    if (!isValid || !initialForm) return
    const next: TransactionUpdateInput = {
      date: form.date,
      amount: amountNumber,
      type: form.type,
      category: form.category.trim(),
      subcategory: form.subcategory.trim(),
      paymentMethod: form.paymentMethod.trim(),
      merchant: form.merchant.trim(),
      note: form.note.trim(),
    }
    const changed: Partial<TransactionUpdateInput> = {}
    ;(Object.keys(next) as (keyof TransactionUpdateInput)[]).forEach((key) => {
      if (String(next[key]) !== String(initialForm[key]).trim()) Object.assign(changed, { [key]: next[key] })
    })
    onSave(isCreate ? next : changed)
  }

  return (
    <>
      <SlideOver
        busy={saving}
        open={open}
        onClose={requestClose}
        title={isCreate ? `Add ${form.type}` : 'Edit Transaction'}
        subtitle={isCreate ? 'Saved straight to your Transactions sheet' : transaction?.sourceId}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={requestClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              loading={saving}
              loadingText="Saving…"
              disabled={(!isCreate && !isDirty) || (attemptedSave && !isValid)}
            >
              {isCreate ? `Add ${form.type}` : 'Save Changes'}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-soft">Date</label>
              <Input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
              {attemptedSave && errors.date && <p className="mt-1 text-[11px] text-danger">{errors.date}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-soft">Amount (₹)</label>
              <Input type="number" min={0} step="0.01" value={form.amount} onChange={(e) => set('amount', e.target.value)} />
              {attemptedSave && errors.amount && <p className="mt-1 text-[11px] text-danger">{errors.amount}</p>}
            </div>
          </div>

          <ThemedSelect label="Type" value={form.type} options={TYPE_OPTIONS} onChange={(v) => set('type', v as FormState['type'])} />

          <ThemedSelect
            label="Category"
            required
            value={form.category}
            options={categoryOptions}
            placeholder="Select category"
            onChange={(v) => set('category', v)}
            error={(attemptedSave && errors.category) || undefined}
          />

          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-soft">Subcategory (optional)</label>
            <Input value={form.subcategory} onChange={(e) => set('subcategory', e.target.value)} placeholder="e.g. Restaurant" />
          </div>

          <ThemedSelect
            label="Payment Method"
            value={form.paymentMethod}
            options={paymentOptions}
            placeholder="Select method"
            onChange={(v) => set('paymentMethod', v)}
          />

          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-soft">Merchant (optional)</label>
            <Input value={form.merchant} onChange={(e) => set('merchant', e.target.value)} placeholder="e.g. Swiggy" />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-soft">Note (optional)</label>
            <Input value={form.note} onChange={(e) => set('note', e.target.value)} placeholder="Any additional detail" />
          </div>
        </div>
      </SlideOver>

      <ConfirmDialog
        open={confirmDiscard}
        title="Discard changes?"
        description="You have unsaved changes. If you leave now, they will be lost."
        confirmLabel="Discard"
        onConfirm={() => {
          setConfirmDiscard(false)
          onClose()
        }}
        onCancel={() => setConfirmDiscard(false)}
      />
    </>
  )
}
