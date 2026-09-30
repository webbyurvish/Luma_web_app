import { useEffect, useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight } from 'lucide-react'
import { SlideOver } from '@/components/ui/SlideOver'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ThemedSelect } from '@/components/ui/ThemedSelect'
import { AccountSelect } from '@/components/finance/AccountSelect'
import { CATEGORY_META } from '@/lib/categoryMeta'
import { todayIstDateKey } from '@/lib/formatDate'
import { accountsForMethod, defaultAccountFor, previewBalanceChanges, rememberAccountFor } from '@/lib/accountLinking'
import { cn } from '@/lib/cn'
import type { FinancialAccount, Transaction, TransactionUpdateInput } from '@/types'

type Kind = 'Expense' | 'Income' | 'Transfer'

interface FormState {
  date: string
  amount: string
  type: Kind
  category: string
  subcategory: string
  paymentMethod: string
  merchant: string
  note: string
  accountId: string
  toAccountId: string
}

const KINDS: { value: Kind; label: string; icon: typeof ArrowUpRight; hint: string }[] = [
  { value: 'Expense', label: 'Expense', icon: ArrowUpRight, hint: 'Money you spent' },
  { value: 'Income', label: 'Income', icon: ArrowDownLeft, hint: 'Money you received' },
  { value: 'Transfer', label: 'Transfer', icon: ArrowLeftRight, hint: 'Between your own accounts' },
]

const QUICK_METHODS = ['UPI', 'Card', 'Cash', 'Bank Transfer', 'Net Banking']

function transactionToForm(t: Transaction): FormState {
  const type: Kind = t.type === 'income' ? 'Income' : t.type === 'transfer' ? 'Transfer' : 'Expense'
  return {
    date: t.date,
    amount: String(t.amount),
    type,
    category: t.rawCategory ?? CATEGORY_META[t.category].label,
    subcategory: t.rawSubcategory ?? '',
    paymentMethod: t.payment === 'Other' ? '' : t.payment,
    merchant: t.merchant ?? '',
    note: t.note ?? '',
    accountId: t.accountId ?? '',
    toAccountId: t.toAccountId ?? '',
  }
}

function emptyForm(type: Kind): FormState {
  return {
    date: todayIstDateKey(),
    amount: '',
    type,
    category: type === 'Income' ? 'Income' : type === 'Transfer' ? 'Transfer' : '',
    subcategory: '',
    paymentMethod: '',
    merchant: '',
    note: '',
    accountId: '',
    toAccountId: '',
  }
}

function applyDraft(form: FormState, draft?: Partial<TransactionUpdateInput>): FormState {
  if (!draft) return form
  const type = draft.type === 'Expense' || draft.type === 'Income' || draft.type === 'Transfer' ? draft.type : form.type
  return {
    ...form,
    type,
    ...(type === 'Transfer' ? { category: 'Transfer' } : {}),
    ...(draft.date ? { date: draft.date } : {}),
    ...(draft.amount ? { amount: String(draft.amount) } : {}),
    ...(draft.category && type !== 'Transfer' ? { category: draft.category } : {}),
    ...(draft.subcategory ? { subcategory: draft.subcategory } : {}),
    ...(draft.paymentMethod ? { paymentMethod: draft.paymentMethod } : {}),
    ...(draft.merchant ? { merchant: draft.merchant } : {}),
    ...(draft.note ? { note: draft.note } : {}),
    ...(draft.accountId ? { accountId: draft.accountId } : {}),
    ...(draft.toAccountId ? { toAccountId: draft.toAccountId } : {}),
  }
}

/** Merges fixed choices with values already used in the sheet, so free-text sheet values stay selectable. */
function toOptions(values: (string | undefined)[]): { value: string; label: string }[] {
  const unique = Array.from(new Set(values.map((v) => v?.trim()).filter((v): v is string => !!v)))
  return unique.sort((a, b) => a.localeCompare(b)).map((value) => ({ value, label: value }))
}

const kindOf = (type: Kind) => (type === 'Income' ? 'income' : type === 'Transfer' ? 'transfer' : 'expense') as 'income' | 'transfer' | 'expense'

interface TransactionEditorProps {
  open: boolean
  /** The transaction to edit; null opens the editor in "add new" mode. */
  transaction: Transaction | null
  /** Starting type for a new transaction. */
  newType?: Kind
  /** Pre-filled values for a new transaction (e.g. from quick-add), still reviewed before saving. */
  draft?: Partial<TransactionUpdateInput>
  /** Every loaded transaction — used to offer the categories/payment methods already in the sheet. */
  allTransactions: Transaction[]
  /** Accounts to link the money to (balances update when saved). */
  accounts: FinancialAccount[]
  onClose: () => void
  /** Receives only the fields that changed, so values the app displays differently from the sheet are never rewritten. */
  onSave: (input: Partial<TransactionUpdateInput>) => void
  saving?: boolean
}

export function TransactionEditor({ open, transaction, newType = 'Expense', draft, allTransactions, accounts, onClose, onSave, saving }: TransactionEditorProps) {
  const isCreate = transaction === null
  const [form, setForm] = useState<FormState | null>(null)
  const [initialForm, setInitialForm] = useState<FormState | null>(null)
  const [attemptedSave, setAttemptedSave] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  // Once the user picks an account themselves, changing the payment method no longer overrides it.
  const [accountTouched, setAccountTouched] = useState(false)

  useEffect(() => {
    if (!open) return
    let next = transaction ? transactionToForm(transaction) : applyDraft(emptyForm(newType), draft)
    if (!transaction && !next.accountId && next.type !== 'Transfer' && next.paymentMethod) {
      next = { ...next, accountId: defaultAccountFor(accounts, next.paymentMethod) }
    }
    setForm(next)
    setInitialForm(next)
    setAttemptedSave(false)
    setAccountTouched(!!transaction || !!draft?.accountId)
    // accounts deliberately left out: a background balance refresh mustn't reset the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, transaction, newType, draft])

  const categoryOptions = useMemo(
    () => toOptions([...Object.values(CATEGORY_META).map((m) => m.label), ...allTransactions.map((t) => t.rawCategory), form?.category]),
    [allTransactions, form?.category],
  )
  const paymentOptions = useMemo(
    () => toOptions([...QUICK_METHODS, ...allTransactions.map((t) => (t.payment === 'Other' ? undefined : t.payment)), form?.paymentMethod]),
    [allTransactions, form?.paymentMethod],
  )

  // Balance preview. When editing, the original entry is already in the balances, so the
  // preview shows the NET effect: undo the old one, apply the new one.
  const previews = useMemo(() => {
    if (!form) return []
    const amount = Number(form.amount) || 0
    let base = accounts
    if (transaction && initialForm) {
      const undo = previewBalanceChanges(accounts, {
        kind: kindOf(initialForm.type),
        amount: Number(initialForm.amount) || 0,
        accountId: initialForm.accountId,
        toAccountId: initialForm.toAccountId,
      })
      const undone = new Map(undo.map((c) => [c.account.id, c.before - (c.after - c.before)]))
      base = accounts.map((a) => (undone.has(a.id) ? { ...a, balance: undone.get(a.id)! } : a))
    }
    const current = new Map(accounts.map((a) => [a.id, a.balance]))
    return (
      previewBalanceChanges(base, { kind: kindOf(form.type), amount, accountId: form.accountId, toAccountId: form.toAccountId })
        // Show "what you have now → what you'll have", and nothing when an edit changes nothing.
        .map((c) => ({ ...c, before: current.get(c.account.id) ?? c.before }))
        .filter((c) => c.before !== c.after)
    )
  }, [form, accounts, transaction, initialForm])

  if (!form) return null

  const isTransfer = form.type === 'Transfer'
  const amountNumber = Number(form.amount)
  const errors = {
    date: /^\d{4}-\d{2}-\d{2}$/.test(form.date) ? '' : 'Pick a date.',
    amount: form.amount.trim() && Number.isFinite(amountNumber) && amountNumber > 0 ? '' : 'Enter an amount above 0.',
    category: isTransfer || form.category.trim() ? '' : 'Category is required.',
    from: !isTransfer || form.accountId ? '' : 'Choose where the money comes from.',
    to: !isTransfer || (form.toAccountId && form.toAccountId !== form.accountId) ? '' : form.toAccountId ? 'Pick a different account.' : 'Choose where the money goes.',
  }
  const isValid = Object.values(errors).every((e) => !e)
  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm)

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => (f ? { ...f, [key]: value } : f))

  const setType = (type: Kind) =>
    setForm((f) => {
      if (!f) return f
      const category = type === 'Transfer' ? 'Transfer' : f.category === 'Transfer' || (f.category === 'Income' && type === 'Expense') ? '' : type === 'Income' && !f.category ? 'Income' : f.category
      return { ...f, type, category, toAccountId: type === 'Transfer' ? f.toAccountId : '' }
    })

  const setMethod = (paymentMethod: string) =>
    setForm((f) => {
      if (!f) return f
      const next = { ...f, paymentMethod }
      if (!accountTouched) next.accountId = defaultAccountFor(accounts, paymentMethod)
      return next
    })

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
      category: isTransfer ? 'Transfer' : form.category.trim(),
      subcategory: form.subcategory.trim(),
      paymentMethod: isTransfer ? 'Transfer' : form.paymentMethod.trim(),
      merchant: form.merchant.trim(),
      note: form.note.trim(),
      accountId: form.accountId,
      toAccountId: isTransfer ? form.toAccountId : '',
    }
    if (form.accountId && form.paymentMethod) rememberAccountFor(form.paymentMethod, form.accountId)
    const changed: Partial<TransactionUpdateInput> = {}
    ;(Object.keys(next) as (keyof TransactionUpdateInput)[]).forEach((key) => {
      if (String(next[key] ?? '') !== String(initialForm[key] ?? '').trim()) Object.assign(changed, { [key]: next[key] })
    })
    onSave(isCreate ? next : changed)
  }

  const { suggested, others } = accountsForMethod(accounts, isTransfer ? '' : form.paymentMethod)
  const allActive = accounts.filter((a) => a.isActive)
  const previewFor = (id: string) => previews.find((p) => p.account.id === id)
  const saveLabel = isCreate ? (isTransfer ? 'Record Transfer' : `Add ${form.type}`) : 'Save Changes'

  return (
    <>
      <SlideOver
        busy={saving}
        open={open}
        onClose={requestClose}
        title={isCreate ? (isTransfer ? 'New Transfer' : `Add ${form.type}`) : 'Edit Transaction'}
        subtitle={isCreate ? 'Saved to your Transactions sheet — linked balances update too' : transaction?.sourceId}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={requestClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={handleSave} loading={saving} loadingText="Saving…" disabled={(!isCreate && !isDirty) || (attemptedSave && !isValid)}>
              {saveLabel}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div role="radiogroup" aria-label="Transaction type" className="grid grid-cols-3 gap-1 rounded-btn border border-border bg-bg-soft p-1">
            {KINDS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={form.type === value}
                onClick={() => setType(value)}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-[7px] px-2 py-1.5 text-[11px] font-medium uppercase tracking-[0.04em] transition-colors',
                  form.type === value ? 'bg-card text-ink shadow-xs' : 'text-ink-muted hover:text-ink',
                )}
              >
                <Icon size={12} className={value === 'Expense' ? 'text-danger' : value === 'Income' ? 'text-success' : 'text-ai'} />
                {label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-soft">Amount (₹)</label>
              <Input type="number" min={0} step="0.01" inputMode="decimal" value={form.amount} onChange={(e) => set('amount', e.target.value)} placeholder="0" />
              {attemptedSave && errors.amount && <p className="mt-1 text-[11px] text-danger">{errors.amount}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-soft">Date</label>
              <Input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
              {attemptedSave && errors.date && <p className="mt-1 text-[11px] text-danger">{errors.date}</p>}
            </div>
          </div>

          {isTransfer ? (
            <>
              <AccountSelect
                label="From"
                value={form.accountId}
                onChange={(id) => set('accountId', id)}
                suggested={[]}
                others={allActive}
                allowNone={false}
                noneLabel="Choose an account"
                change={previewFor(form.accountId)}
                error={attemptedSave ? errors.from : undefined}
              />
              <AccountSelect
                label="To"
                value={form.toAccountId}
                onChange={(id) => set('toAccountId', id)}
                suggested={[]}
                others={allActive.filter((a) => a.id !== form.accountId)}
                allowNone={false}
                noneLabel="Choose an account"
                change={previewFor(form.toAccountId)}
                hint="Paying a credit card bill? Choose the card here — what you owe goes down."
                error={attemptedSave ? errors.to : undefined}
              />
            </>
          ) : (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-ink-soft">{form.type === 'Income' ? 'Received via' : 'Paid via'}</label>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {QUICK_METHODS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMethod(m)}
                      aria-pressed={form.paymentMethod === m}
                      className={cn(
                        'rounded-pill border px-2.5 py-1 text-[11px] transition-colors',
                        form.paymentMethod === m ? 'border-ink bg-ink text-paper' : 'border-border text-ink-soft hover:border-ink/40 hover:text-ink',
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <ThemedSelect value={form.paymentMethod} options={paymentOptions} placeholder="Other method…" onChange={setMethod} aria-label="Payment method" />
              </div>

              <AccountSelect
                label={form.type === 'Income' ? 'Received in' : 'Paid from'}
                value={form.accountId}
                onChange={(id) => {
                  setAccountTouched(true)
                  set('accountId', id)
                }}
                suggested={suggested}
                others={others}
                change={previewFor(form.accountId)}
                hint={
                  accounts.length
                    ? 'Linking an account keeps its balance in step automatically.'
                    : 'Add your bank, card and cash accounts in Finance to track their balances here.'
                }
              />

              <ThemedSelect
                label="Category"
                required
                value={form.category}
                options={categoryOptions}
                placeholder="Select category"
                onChange={(v) => set('category', v)}
                error={(attemptedSave && errors.category) || undefined}
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-ink-soft">Merchant (optional)</label>
                  <Input value={form.merchant} onChange={(e) => set('merchant', e.target.value)} placeholder="e.g. Swiggy" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-ink-soft">Subcategory (optional)</label>
                  <Input value={form.subcategory} onChange={(e) => set('subcategory', e.target.value)} placeholder="e.g. Restaurant" />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-soft">Note (optional)</label>
            <Input value={form.note} onChange={(e) => set('note', e.target.value)} placeholder={isTransfer ? 'e.g. September card bill' : 'Any additional detail'} />
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
