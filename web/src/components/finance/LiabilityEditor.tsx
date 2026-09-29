import { useEffect, useState } from 'react'
import { SlideOver } from '@/components/ui/SlideOver'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ThemedSelect } from '@/components/ui/ThemedSelect'
import type { Liability, LiabilityInput, LiabilityType } from '@/types'

interface FormState {
  name: string
  type: LiabilityType | ''
  amount: string
}

const EMPTY_FORM: FormState = { name: '', type: '', amount: '' }

const TYPE_OPTIONS = [
  { value: 'loan', label: 'Loan' },
  { value: 'other', label: 'Other' },
]

function liabilityToForm(liability: Liability): FormState {
  return { name: liability.name, type: liability.type, amount: String(liability.amount) }
}

interface LiabilityEditorProps {
  open: boolean
  /** When set, the editor pre-fills from this liability and behaves as an edit rather than a create. */
  liability?: Liability | null
  onClose: () => void
  onSave: (input: LiabilityInput) => void
  /** True while the create/update request is in flight — disables Save and prevents double submission. */
  saving?: boolean
}

export function LiabilityEditor({ open, liability, onClose, onSave, saving }: LiabilityEditorProps) {
  const isEdit = !!liability
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [attemptedSave, setAttemptedSave] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(liability ? liabilityToForm(liability) : EMPTY_FORM)
      setAttemptedSave(false)
    }
  }, [open, liability])

  const amountNumber = Number(form.amount)
  const errors = {
    name: form.name.trim() ? '' : 'Name is required.',
    type: form.type ? '' : 'Type is required.',
    amount: form.amount.trim() && !Number.isNaN(amountNumber) && amountNumber >= 0 ? '' : 'Enter a valid amount.',
  }
  const isValid = !errors.name && !errors.type && !errors.amount

  const handleSave = () => {
    setAttemptedSave(true)
    if (!isValid || !form.type) return
    onSave({ name: form.name.trim(), type: form.type, amount: amountNumber })
  }

  return (
    <SlideOver
      busy={saving}
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Liability' : 'Add Liability'}
      subtitle="Loans and other amounts you owe"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={handleSave} loading={saving} loadingText="Saving…" disabled={attemptedSave && !isValid}>
            {isEdit ? 'Save Changes' : 'Save Liability'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-ink-soft">Name</label>
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Personal Loan" />
          {attemptedSave && errors.name && <p className="mt-1 text-[11px] text-danger">{errors.name}</p>}
        </div>

        <ThemedSelect
          label="Type"
          required
          value={form.type}
          options={TYPE_OPTIONS}
          placeholder="Select type"
          onChange={(next) => setForm((f) => ({ ...f, type: next as LiabilityType }))}
          error={(attemptedSave && errors.type) || undefined}
        />

        <div>
          <label className="mb-1.5 block text-xs font-medium text-ink-soft">Amount Owed (₹)</label>
          <Input value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="0" type="number" min={0} />
          {attemptedSave && errors.amount && <p className="mt-1 text-[11px] text-danger">{errors.amount}</p>}
        </div>
      </div>
    </SlideOver>
  )
}
