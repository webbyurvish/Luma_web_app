import { useEffect, useState } from 'react'
import { SlideOver } from '@/components/ui/SlideOver'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ThemedSelect } from '@/components/ui/ThemedSelect'
import { INVESTMENT_TYPE_OPTIONS } from '@/lib/investmentMeta'
import type { FinancialAccount, Investment, InvestmentInput, InvestmentType } from '@/types'

interface FormState {
  name: string
  type: InvestmentType | ''
  platformAccountId: string
  investedAmount: string
  currentValue: string
  quantity: string
  averagePrice: string
  currentPrice: string
  purchaseDate: string
  notes: string
}

const EMPTY_FORM: FormState = {
  name: '',
  type: '',
  platformAccountId: '',
  investedAmount: '',
  currentValue: '',
  quantity: '',
  averagePrice: '',
  currentPrice: '',
  purchaseDate: '',
  notes: '',
}

function investmentToForm(investment: Investment): FormState {
  return {
    name: investment.name,
    type: investment.type,
    platformAccountId: investment.platformAccountId ?? '',
    investedAmount: String(investment.investedAmount),
    currentValue: String(investment.currentValue),
    quantity: investment.quantity !== undefined ? String(investment.quantity) : '',
    averagePrice: investment.averagePrice !== undefined ? String(investment.averagePrice) : '',
    currentPrice: investment.currentPrice !== undefined ? String(investment.currentPrice) : '',
    purchaseDate: investment.purchaseDate ?? '',
    notes: investment.notes ?? '',
  }
}

interface InvestmentEditorProps {
  open: boolean
  investment: Investment | null
  accounts: FinancialAccount[]
  onClose: () => void
  onSave: (input: InvestmentInput) => void
}

export function InvestmentEditor({ open, investment, accounts, onClose, onSave }: InvestmentEditorProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [initialForm, setInitialForm] = useState<FormState>(EMPTY_FORM)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [attemptedSave, setAttemptedSave] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  useEffect(() => {
    if (!open) return
    const next = investment ? investmentToForm(investment) : EMPTY_FORM
    setForm(next)
    setInitialForm(next)
    setTouched({})
    setAttemptedSave(false)
  }, [open, investment])

  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm)
  const investedNumber = Number(form.investedAmount)
  const currentNumber = Number(form.currentValue)
  const errors = {
    name: form.name.trim() ? '' : 'Name is required.',
    type: form.type ? '' : 'Type is required.',
    investedAmount: form.investedAmount.trim() && !Number.isNaN(investedNumber) && investedNumber >= 0 ? '' : 'Enter a valid amount.',
    currentValue: form.currentValue.trim() && !Number.isNaN(currentNumber) && currentNumber >= 0 ? '' : 'Enter a valid value.',
  }
  const isValid = !errors.name && !errors.type && !errors.investedAmount && !errors.currentValue

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
      platformAccountId: form.platformAccountId || undefined,
      investedAmount: investedNumber,
      currentValue: currentNumber,
      quantity: form.quantity.trim() ? Number(form.quantity) : undefined,
      averagePrice: form.averagePrice.trim() ? Number(form.averagePrice) : undefined,
      currentPrice: form.currentPrice.trim() ? Number(form.currentPrice) : undefined,
      purchaseDate: form.purchaseDate || undefined,
      notes: form.notes.trim() || undefined,
    })
  }

  const showError = (field: keyof typeof errors) => (touched[field] || attemptedSave) && errors[field]
  const platformOptions = accounts.filter((a) => a.isActive).map((a) => ({ value: a.id, label: a.name }))

  return (
    <>
      <SlideOver
        open={open}
        onClose={requestClose}
        title={investment ? 'Edit Investment' : 'Add Investment'}
        subtitle={investment ? 'Update this holding' : 'Track a fund, stock, or deposit'}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={requestClose}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={handleSave} disabled={attemptedSave && !isValid}>
              Save Investment
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-soft">Name</label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              onBlur={() => setTouched((t) => ({ ...t, name: true }))}
              placeholder="e.g. Parag Parikh Flexi Cap"
            />
            {showError('name') && <p className="mt-1 text-[11px] text-danger">{errors.name}</p>}
          </div>

          <ThemedSelect
            label="Type"
            required
            value={form.type}
            options={INVESTMENT_TYPE_OPTIONS}
            placeholder="Select type"
            onChange={(next) => setForm((f) => ({ ...f, type: next as InvestmentType }))}
            onBlur={() => setTouched((t) => ({ ...t, type: true }))}
            error={showError('type') || undefined}
          />

          <ThemedSelect
            label="Platform (optional)"
            value={form.platformAccountId}
            options={platformOptions}
            placeholder="Where is it held?"
            onChange={(next) => setForm((f) => ({ ...f, platformAccountId: next }))}
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-soft">Invested (₹)</label>
              <Input
                value={form.investedAmount}
                onChange={(e) => setForm((f) => ({ ...f, investedAmount: e.target.value }))}
                onBlur={() => setTouched((t) => ({ ...t, investedAmount: true }))}
                placeholder="0"
                type="number"
                min={0}
              />
              {showError('investedAmount') && <p className="mt-1 text-[11px] text-danger">{errors.investedAmount}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-soft">Current Value (₹)</label>
              <Input
                value={form.currentValue}
                onChange={(e) => setForm((f) => ({ ...f, currentValue: e.target.value }))}
                onBlur={() => setTouched((t) => ({ ...t, currentValue: true }))}
                placeholder="0"
                type="number"
                min={0}
              />
              {showError('currentValue') && <p className="mt-1 text-[11px] text-danger">{errors.currentValue}</p>}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-soft">Quantity</label>
              <Input value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} placeholder="Optional" type="number" min={0} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-soft">Avg. Price</label>
              <Input
                value={form.averagePrice}
                onChange={(e) => setForm((f) => ({ ...f, averagePrice: e.target.value }))}
                placeholder="Optional"
                type="number"
                min={0}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-soft">Current Price</label>
              <Input
                value={form.currentPrice}
                onChange={(e) => setForm((f) => ({ ...f, currentPrice: e.target.value }))}
                placeholder="Optional"
                type="number"
                min={0}
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-soft">Purchase Date (optional)</label>
            <Input value={form.purchaseDate} onChange={(e) => setForm((f) => ({ ...f, purchaseDate: e.target.value }))} type="date" />
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
