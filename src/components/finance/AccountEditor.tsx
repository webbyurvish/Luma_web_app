import { useEffect, useState } from 'react'
import { SlideOver } from '@/components/ui/SlideOver'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ThemedSelect } from '@/components/ui/ThemedSelect'
import { ACCOUNT_TYPE_OPTIONS } from '@/lib/accountMeta'
import type { AccountInput, AccountType } from '@/types'

interface FormState {
  name: string
  type: AccountType | ''
  institution: string
  accountNumberLast4: string
  balance: string
  notes: string
}

const EMPTY_FORM: FormState = { name: '', type: '', institution: '', accountNumberLast4: '', balance: '', notes: '' }

interface AccountEditorProps {
  open: boolean
  onClose: () => void
  onSave: (input: AccountInput) => void
  /** True while the create request is in flight — disables Save and prevents double submission. */
  saving?: boolean
}

export function AccountEditor({ open, onClose, onSave, saving }: AccountEditorProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [initialForm, setInitialForm] = useState<FormState>(EMPTY_FORM)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [attemptedSave, setAttemptedSave] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(EMPTY_FORM)
    setInitialForm(EMPTY_FORM)
    setTouched({})
    setAttemptedSave(false)
  }, [open])

  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm)
  const balanceNumber = Number(form.balance)
  const errors = {
    name: form.name.trim() ? '' : 'Account name is required.',
    type: form.type ? '' : 'Account type is required.',
    balance: form.balance.trim() && !Number.isNaN(balanceNumber) && balanceNumber >= 0 ? '' : 'Enter a valid balance.',
  }
  const isValid = !errors.name && !errors.type && !errors.balance

  const requestClose = () => {
    if (isDirty) setConfirmDiscard(true)
    else onClose()
  }

  const handleSave = () => {
    setAttemptedSave(true)
    if (!isValid || !form.type) return
    onSave({
      name: form.name.trim(),
      type: form.type,
      institution: form.institution.trim() || undefined,
      accountNumberLast4: form.accountNumberLast4.trim().slice(-4) || undefined,
      balance: balanceNumber,
      currency: 'INR',
      notes: form.notes.trim() || undefined,
    })
  }

  const showError = (field: keyof typeof errors) => (touched[field] || attemptedSave) && errors[field]

  return (
    <>
      <SlideOver
        open={open}
        onClose={requestClose}
        title="Add Account"
        subtitle="Track where your money lives"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={requestClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={handleSave} disabled={saving || (attemptedSave && !isValid)}>
              {saving ? 'Saving…' : 'Save Account'}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-soft">Account Name</label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              onBlur={() => setTouched((t) => ({ ...t, name: true }))}
              placeholder="e.g. HDFC Bank"
            />
            {showError('name') && <p className="mt-1 text-[11px] text-danger">{errors.name}</p>}
          </div>

          <ThemedSelect
            label="Account Type"
            required
            value={form.type}
            options={ACCOUNT_TYPE_OPTIONS}
            placeholder="Select account type"
            onChange={(next) => setForm((f) => ({ ...f, type: next as AccountType }))}
            onBlur={() => setTouched((t) => ({ ...t, type: true }))}
            error={showError('type') || undefined}
          />

          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-soft">Institution (optional)</label>
            <Input
              value={form.institution}
              onChange={(e) => setForm((f) => ({ ...f, institution: e.target.value }))}
              placeholder="e.g. HDFC Bank"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-soft">Last 4 digits (optional)</label>
            <Input
              value={form.accountNumberLast4}
              onChange={(e) => setForm((f) => ({ ...f, accountNumberLast4: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
              placeholder="4821"
              inputMode="numeric"
              maxLength={4}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-soft">
              {form.type === 'credit_card' ? 'Outstanding Amount (₹)' : 'Current Balance (₹)'}
            </label>
            <Input
              value={form.balance}
              onChange={(e) => setForm((f) => ({ ...f, balance: e.target.value }))}
              onBlur={() => setTouched((t) => ({ ...t, balance: true }))}
              placeholder="0"
              type="number"
              min={0}
            />
            {showError('balance') && <p className="mt-1 text-[11px] text-danger">{errors.balance}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-soft">Notes (optional)</label>
            <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Any additional detail" />
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
