import { useEffect, useState } from 'react'
import { SlideOver } from '@/components/ui/SlideOver'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ThemedSelect } from '@/components/ui/ThemedSelect'
import { Switch } from '@/components/ui/Switch'
import type { FinancialAccount, SIPFrequency, SIPInput } from '@/types'

interface FormState {
  name: string
  fundName: string
  platformAccountId: string
  amount: string
  frequency: SIPFrequency
  debitDay: string
  startDate: string
  endDate: string
  category: string
  isActive: boolean
}

const EMPTY_FORM: FormState = {
  name: '',
  fundName: '',
  platformAccountId: '',
  amount: '',
  frequency: 'monthly',
  debitDay: '',
  startDate: '',
  endDate: '',
  category: '',
  isActive: true,
}

const FREQUENCY_OPTIONS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
]

interface SipEditorProps {
  open: boolean
  accounts: FinancialAccount[]
  onClose: () => void
  onSave: (input: SIPInput) => void
  /** True while the create request is in flight — disables Save and prevents double submission. */
  saving?: boolean
}

export function SipEditor({ open, accounts, onClose, onSave, saving }: SipEditorProps) {
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
  const amountNumber = Number(form.amount)
  const dayNumber = Number(form.debitDay)
  const errors = {
    name: form.name.trim() ? '' : 'SIP name is required.',
    fundName: form.fundName.trim() ? '' : 'Fund name is required.',
    amount: form.amount.trim() && !Number.isNaN(amountNumber) && amountNumber > 0 ? '' : 'Enter a valid amount.',
    debitDay: !form.debitDay.trim() || (dayNumber >= 1 && dayNumber <= 28) ? '' : 'Day must be between 1 and 28.',
  }
  const isValid = !errors.name && !errors.fundName && !errors.amount && !errors.debitDay

  const requestClose = () => {
    if (isDirty) setConfirmDiscard(true)
    else onClose()
  }

  const handleSave = () => {
    setAttemptedSave(true)
    if (!isValid) return
    onSave({
      name: form.name.trim(),
      fundName: form.fundName.trim(),
      platformAccountId: form.platformAccountId || undefined,
      amount: amountNumber,
      frequency: form.frequency,
      debitDay: form.debitDay.trim() ? dayNumber : undefined,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      category: form.category.trim() || undefined,
      isActive: form.isActive,
    })
  }

  const showError = (field: keyof typeof errors) => (touched[field] || attemptedSave) && errors[field]
  const platformOptions = accounts.filter((a) => a.isActive).map((a) => ({ value: a.id, label: a.name }))

  return (
    <>
      <SlideOver
        open={open}
        onClose={requestClose}
        title="Add SIP"
        subtitle="Set up a recurring investment"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={requestClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={handleSave} disabled={saving || (attemptedSave && !isValid)}>
              {saving ? 'Saving…' : 'Save SIP'}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-soft">SIP Name</label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              onBlur={() => setTouched((t) => ({ ...t, name: true }))}
              placeholder="e.g. Parag Parikh Flexi Cap SIP"
            />
            {showError('name') && <p className="mt-1 text-[11px] text-danger">{errors.name}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-soft">Fund Name</label>
            <Input
              value={form.fundName}
              onChange={(e) => setForm((f) => ({ ...f, fundName: e.target.value }))}
              onBlur={() => setTouched((t) => ({ ...t, fundName: true }))}
              placeholder="e.g. Parag Parikh Flexi Cap"
            />
            {showError('fundName') && <p className="mt-1 text-[11px] text-danger">{errors.fundName}</p>}
          </div>

          <ThemedSelect
            label="Platform (optional)"
            value={form.platformAccountId}
            options={platformOptions}
            placeholder="Where is it managed?"
            onChange={(next) => setForm((f) => ({ ...f, platformAccountId: next }))}
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-soft">Amount (₹)</label>
              <Input
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                onBlur={() => setTouched((t) => ({ ...t, amount: true }))}
                placeholder="0"
                type="number"
                min={0}
              />
              {showError('amount') && <p className="mt-1 text-[11px] text-danger">{errors.amount}</p>}
            </div>
            <ThemedSelect
              label="Frequency"
              value={form.frequency}
              options={FREQUENCY_OPTIONS}
              onChange={(next) => setForm((f) => ({ ...f, frequency: next as SIPFrequency }))}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-soft">Debit Day (1–28, optional)</label>
            <Input
              value={form.debitDay}
              onChange={(e) => setForm((f) => ({ ...f, debitDay: e.target.value }))}
              onBlur={() => setTouched((t) => ({ ...t, debitDay: true }))}
              placeholder="e.g. 5"
              type="number"
              min={1}
              max={28}
            />
            {showError('debitDay') && <p className="mt-1 text-[11px] text-danger">{errors.debitDay}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-soft">Start Date (optional)</label>
              <Input value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} type="date" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-soft">End Date (optional)</label>
              <Input value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} type="date" />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-soft">Category (optional)</label>
            <Input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="e.g. Equity" />
          </div>

          <div className="flex items-center justify-between rounded-sm border border-border-soft bg-surface px-3 py-2.5">
            <div>
              <p className="text-xs font-medium text-ink">Active</p>
              <p className="text-[10px] text-ink-muted">Inactive SIPs stay in history but are excluded from totals.</p>
            </div>
            <Switch checked={form.isActive} onChange={(checked) => setForm((f) => ({ ...f, isActive: checked }))} label="Active" />
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
