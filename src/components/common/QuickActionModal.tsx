import { type FormEvent, useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { ThemedSelect } from '@/components/ui/ThemedSelect'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/context/ToastContext'

export type QuickActionKind = 'expense' | 'income' | 'udhaar' | 'repayment' | 'task' | 'document'

interface QuickActionConfig {
  title: string
  subtitle: string
  submitLabel: string
  successMessage: string
}

const CONFIG: Record<QuickActionKind, QuickActionConfig> = {
  expense: { title: 'Add Expense', subtitle: 'Log a new expense', submitLabel: 'Add Expense', successMessage: 'Expense added (demo — not saved yet)' },
  income: { title: 'Add Income', subtitle: 'Log a new income entry', submitLabel: 'Add Income', successMessage: 'Income added (demo — not saved yet)' },
  udhaar: { title: 'Add Udhaar', subtitle: 'Record money given to someone', submitLabel: 'Add Udhaar', successMessage: 'Udhaar recorded (demo — not saved yet)' },
  repayment: { title: 'Add Repayment', subtitle: 'Record a repayment received', submitLabel: 'Add Repayment', successMessage: 'Repayment recorded (demo — not saved yet)' },
  task: { title: 'Add Task', subtitle: 'Create a new task or reminder', submitLabel: 'Add Task', successMessage: 'Task added (demo — not saved yet)' },
  document: { title: 'Upload Document', subtitle: 'Add a document to your library', submitLabel: 'Upload', successMessage: 'Document upload is coming in a future phase' },
}

const categoryOptions = ['Food', 'Transport', 'Shopping', 'Bills', 'Entertainment', 'Health', 'Other'].map((label) => ({ value: label, label }))
const priorityOptions = ['Low', 'Medium', 'High'].map((label) => ({ value: label, label }))
const paymentOptions = ['UPI', 'Card', 'Cash', 'Bank Transfer', 'Net Banking'].map((label) => ({ value: label, label }))

interface QuickActionModalProps {
  open: boolean
  kind: QuickActionKind
  onClose: () => void
}

export function QuickActionModal({ open, kind, onClose }: QuickActionModalProps) {
  const { showToast } = useToast()
  const config = CONFIG[kind]
  const [submitting, setSubmitting] = useState(false)
  const [category, setCategory] = useState('')
  const [payment, setPayment] = useState('')
  const [priority, setPriority] = useState('')

  useEffect(() => {
    if (!open) return
    setCategory('')
    setPayment('')
    setPriority('')
  }, [open, kind])

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setTimeout(() => {
      setSubmitting(false)
      showToast(config.successMessage)
      onClose()
    }, 450)
  }

  return (
    <Modal open={open} onClose={onClose} title={config.title} subtitle={config.subtitle} busy={submitting}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {(kind === 'expense' || kind === 'income' || kind === 'udhaar' || kind === 'repayment') && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-soft">Amount (₹)</label>
            <Input type="number" min={0} placeholder="0" required />
          </div>
        )}

        {(kind === 'expense' || kind === 'income') && (
          <ThemedSelect label="Category" value={category} onChange={setCategory} options={categoryOptions} placeholder="Select category" />
        )}

        {(kind === 'udhaar' || kind === 'repayment') && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-soft">Person</label>
            <Input placeholder="e.g. Rahul Mehta" required />
          </div>
        )}

        {(kind === 'expense' || kind === 'income' || kind === 'udhaar' || kind === 'repayment') && (
          <ThemedSelect label="Payment Method" value={payment} onChange={setPayment} options={paymentOptions} placeholder="Select method" />
        )}

        {kind === 'task' && (
          <>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-soft">Task Title</label>
              <Input placeholder="e.g. Pay electricity bill" required />
            </div>
            <ThemedSelect label="Priority" value={priority} onChange={setPriority} options={priorityOptions} placeholder="Select priority" />
          </>
        )}

        {kind === 'document' && (
          <div className="flex flex-col items-center justify-center gap-2 rounded-btn border border-dashed border-border bg-bg-soft px-4 py-8 text-center">
            <p className="text-xs text-ink-soft">File uploads arrive in a future phase</p>
          </div>
        )}

        {kind !== 'document' && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-soft">
              {kind === 'task' ? 'Due Date' : 'Date'}
            </label>
            <Input type="date" defaultValue="2026-09-22" required />
          </div>
        )}

        <div className="mt-2 flex items-center justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting} loadingText="Saving…">
            {config.submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
