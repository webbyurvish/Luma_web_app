import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { TransactionEditor } from '@/components/transactions/TransactionEditor'
import { UdhaarEntryEditor } from '@/components/udhaar/UdhaarEntryEditor'
import { TaskEditor } from '@/components/tasks/TaskEditor'
import { useTransactions } from '@/hooks/useTransactions'
import { useTasks, useUdhaar } from '@/hooks/useLifeCollections'
import { useToast } from '@/context/ToastContext'
import { getErrorMessage } from '@/lib/errors'
import type { QuickAddDraft } from '@/services/googleSheetsApi'
import type { TaskInput, TransactionUpdateInput, UdhaarEntryInput } from '@/types'

export type QuickActionKind = 'expense' | 'income' | 'udhaar' | 'repayment' | 'task' | 'document'

interface QuickActionModalProps {
  open: boolean
  kind: QuickActionKind
  onClose: () => void
  /** AI-parsed values to pre-fill (quick-add); the user still reviews and saves. */
  draft?: QuickAddDraft | null
}

/**
 * The Dashboard's quick "Add …" entry point. Opens the same real editor each page uses, so
 * anything added here is saved to the sheet exactly like it would be from its own page.
 */
export function QuickActionModal({ open, kind, onClose, draft }: QuickActionModalProps) {
  const d = draft ?? undefined
  if (kind === 'expense' || kind === 'income') return <QuickTransaction open={open} type={kind === 'income' ? 'Income' : 'Expense'} onClose={onClose} draft={d} />
  if (kind === 'udhaar' || kind === 'repayment') return <QuickUdhaar open={open} type={kind === 'udhaar' ? 'given' : 'repayment'} onClose={onClose} draft={d} />
  if (kind === 'task') return <QuickTask open={open} onClose={onClose} draft={d} />
  return <QuickDocument open={open} onClose={onClose} />
}

function useSaveHandler(onClose: () => void) {
  const { showToast } = useToast()
  return async (action: () => Promise<void>, success: string, failure: string) => {
    try {
      await action()
      showToast(success)
      onClose()
    } catch (err) {
      showToast(getErrorMessage(err, failure), 'error')
    }
  }
}

function QuickTransaction({ open, type, onClose, draft }: { open: boolean; type: 'Expense' | 'Income'; onClose: () => void; draft?: QuickAddDraft }) {
  const txDraft = useMemo(
    () =>
      draft && {
        type,
        amount: draft.amount ?? undefined,
        date: draft.date ?? undefined,
        category: draft.category ?? undefined,
        subcategory: draft.subcategory ?? undefined,
        merchant: draft.merchant ?? undefined,
        paymentMethod: draft.paymentMethod ?? undefined,
        note: draft.note ?? undefined,
      },
    [draft, type],
  )
  const { transactions, createTransaction, creating } = useTransactions()
  const save = useSaveHandler(onClose)
  return (
    <TransactionEditor
      open={open}
      transaction={null}
      newType={type}
      draft={txDraft ?? undefined}
      allTransactions={transactions}
      onClose={onClose}
      onSave={(input) => save(() => createTransaction(input as TransactionUpdateInput), `${input.type ?? type} added`, "Couldn't add the transaction. Please try again.")}
      saving={creating}
    />
  )
}

function QuickUdhaar({ open, type, onClose, draft }: { open: boolean; type: 'given' | 'repayment'; onClose: () => void; draft?: QuickAddDraft }) {
  const udhaarDraft = useMemo(
    () =>
      draft && {
        type,
        person: draft.person ?? undefined,
        amount: draft.amount ?? undefined,
        date: draft.date ?? undefined,
        dueDate: draft.dueDate ?? undefined,
        paymentMethod: draft.paymentMethod ?? undefined,
        note: draft.note ?? undefined,
      },
    [draft, type],
  )
  const { people, createEntry, creating } = useUdhaar()
  const save = useSaveHandler(onClose)
  return (
    <UdhaarEntryEditor
      open={open}
      entry={null}
      draft={udhaarDraft ?? undefined}
      newType={type}
      knownPeople={people.map((p) => p.name)}
      onClose={onClose}
      onSave={(input: UdhaarEntryInput) =>
        save(
          () => createEntry(input),
          input.type === 'given' ? `Udhaar to ${input.person} added` : `Repayment from ${input.person} recorded`,
          "Couldn't save the udhaar entry. Please try again.",
        )
      }
      saving={creating}
    />
  )
}

function QuickTask({ open, onClose, draft }: { open: boolean; onClose: () => void; draft?: QuickAddDraft }) {
  const taskDraft = useMemo(
    () =>
      draft && {
        title: draft.title ?? draft.note ?? undefined,
        dueDate: draft.dueDate ?? draft.date ?? undefined,
        priority: draft.priority ?? undefined,
      },
    [draft],
  )
  const { createTask, creating } = useTasks()
  const save = useSaveHandler(onClose)
  return (
    <TaskEditor
      open={open}
      task={null}
      draft={taskDraft ?? undefined}
      onClose={onClose}
      onSave={(input: TaskInput) => save(() => createTask(input), 'Task added', "Couldn't add the task. Please try again.")}
      saving={creating}
    />
  )
}

/** Documents live in Google Drive now: hand over to the Documents page, which opens the file picker. */
function QuickDocument({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  useEffect(() => {
    if (!open) return
    onClose()
    navigate('/documents', { state: { upload: true } })
  }, [open, onClose, navigate])
  return null
}
