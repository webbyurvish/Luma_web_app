import { useEffect, useState } from 'react'
import { SlideOver } from '@/components/ui/SlideOver'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/cn'
import { todayIstDateKey } from '@/lib/formatDate'
import type { UdhaarEntry, UdhaarEntryInput, UdhaarEntryType } from '@/types'

interface FormState {
  type: UdhaarEntryType
  person: string
  amount: string
  date: string
  dueDate: string
  description: string
  paymentMethod: string
  note: string
}

function entryToForm(entry: UdhaarEntry): FormState {
  return {
    type: entry.type,
    person: entry.person,
    amount: String(entry.amount),
    date: entry.date,
    dueDate: entry.dueDate ?? '',
    description: entry.description ?? '',
    paymentMethod: entry.paymentMethod ?? '',
    note: entry.note ?? '',
  }
}

interface UdhaarEntryEditorProps {
  open: boolean
  /** The entry to edit; null opens in "add new" mode. */
  entry: UdhaarEntry | null
  /** For a new entry: Given (money lent) or Repayment (money received back). */
  newType?: UdhaarEntryType
  /** For a new entry: pre-fills the person, e.g. "Add repayment" from a person's row. */
  newPerson?: string
  /** Pre-filled values for a new entry (e.g. from quick-add), still reviewed before saving. */
  draft?: Partial<UdhaarEntryInput>
  /** Everyone already in the ledger, offered as suggestions so names stay consistent. */
  knownPeople: string[]
  onClose: () => void
  onSave: (input: UdhaarEntryInput) => void
  saving?: boolean
}

export function UdhaarEntryEditor({ open, entry, newType = 'given', newPerson = '', draft, knownPeople, onClose, onSave, saving }: UdhaarEntryEditorProps) {
  const isCreate = entry === null
  const [form, setForm] = useState<FormState | null>(null)
  const [initialForm, setInitialForm] = useState<FormState | null>(null)
  const [attemptedSave, setAttemptedSave] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  useEffect(() => {
    if (!open) return
    const next: FormState = entry
      ? entryToForm(entry)
      : {
          type: draft?.type ?? newType,
          person: draft?.person ?? newPerson,
          amount: draft?.amount ? String(draft.amount) : '',
          date: draft?.date ?? todayIstDateKey(),
          dueDate: draft?.dueDate ?? '',
          description: draft?.description ?? '',
          paymentMethod: draft?.paymentMethod ?? '',
          note: draft?.note ?? '',
        }
    setForm(next)
    setInitialForm(next)
    setAttemptedSave(false)
  }, [open, entry, newType, newPerson, draft])

  if (!form) return null

  const amountNumber = Number(form.amount)
  const errors = {
    person: form.person.trim() ? '' : 'Who is this with?',
    amount: form.amount.trim() && Number.isFinite(amountNumber) && amountNumber > 0 ? '' : 'Enter an amount above 0.',
    date: /^\d{4}-\d{2}-\d{2}$/.test(form.date) ? '' : 'Pick a date.',
  }
  const isValid = !errors.person && !errors.amount && !errors.date
  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm)
  const isGiven = form.type === 'given'

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => (f ? { ...f, [key]: value } : f))
  const requestClose = () => (isDirty ? setConfirmDiscard(true) : onClose())

  const handleSave = () => {
    setAttemptedSave(true)
    if (!isValid) return
    onSave({
      person: form.person.trim(),
      type: form.type,
      amount: amountNumber,
      date: form.date,
      dueDate: isGiven && form.dueDate ? form.dueDate : undefined,
      description: form.description.trim() || undefined,
      paymentMethod: form.paymentMethod.trim() || undefined,
      note: form.note.trim() || undefined,
    })
  }

  const saveLabel = isCreate ? (isGiven ? 'Add Udhaar' : 'Add Repayment') : 'Save Changes'

  return (
    <>
      <SlideOver
        busy={saving}
        open={open}
        onClose={requestClose}
        title={isCreate ? saveLabel : 'Edit Udhaar Entry'}
        subtitle={isGiven ? 'Money you gave someone' : 'Money someone paid you back'}
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
              {saveLabel}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div role="radiogroup" aria-label="Entry type" className="grid grid-cols-2 gap-1 rounded-btn border border-border bg-bg-soft p-1">
            {(['given', 'repayment'] as const).map((type) => (
              <button
                key={type}
                type="button"
                role="radio"
                aria-checked={form.type === type}
                onClick={() => set('type', type)}
                className={cn(
                  'rounded-[7px] px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.04em] transition-colors',
                  form.type === type ? 'bg-card text-ink shadow-xs' : 'text-ink-muted hover:text-ink',
                )}
              >
                {type === 'given' ? 'I gave money' : 'I got paid back'}
              </button>
            ))}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-soft">Person</label>
            <Input value={form.person} onChange={(e) => set('person', e.target.value)} placeholder="e.g. Rahul Mehta" list="udhaar-people" autoComplete="off" />
            <datalist id="udhaar-people">
              {knownPeople.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            {attemptedSave && errors.person && <p className="mt-1 text-[11px] text-danger">{errors.person}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-soft">Amount (₹)</label>
              <Input type="number" min={0} step="0.01" value={form.amount} onChange={(e) => set('amount', e.target.value)} placeholder="0" />
              {attemptedSave && errors.amount && <p className="mt-1 text-[11px] text-danger">{errors.amount}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-soft">Date</label>
              <Input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
              {attemptedSave && errors.date && <p className="mt-1 text-[11px] text-danger">{errors.date}</p>}
            </div>
          </div>

          {isGiven && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-soft">Due date (optional)</label>
              <Input type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-soft">Description (optional)</label>
            <Input value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="e.g. Trip advance" />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-soft">Payment method (optional)</label>
            <Input value={form.paymentMethod} onChange={(e) => set('paymentMethod', e.target.value)} placeholder="e.g. UPI" />
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
