import { useEffect, useState } from 'react'
import { SlideOver } from '@/components/ui/SlideOver'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ThemedSelect } from '@/components/ui/ThemedSelect'
import type { Task, TaskInput, TaskPriority, TaskStatus } from '@/types'

interface FormState {
  title: string
  description: string
  dueDate: string
  priority: TaskPriority
  category: string
  status: TaskStatus
}

const EMPTY_FORM: FormState = { title: '', description: '', dueDate: '', priority: 'medium', category: '', status: 'Todo' }

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

const STATUS_OPTIONS = ['Todo', 'In Progress', 'Completed', 'Cancelled'].map((s) => ({ value: s, label: s }))

function taskToForm(task: Task): FormState {
  return {
    title: task.title,
    description: task.description ?? '',
    dueDate: task.dueDate ?? '',
    priority: task.priority,
    category: task.category ?? '',
    status: task.status,
  }
}

interface TaskEditorProps {
  open: boolean
  /** The task to edit; null opens in "add new" mode. */
  task: Task | null
  /** Pre-filled values for a new task (e.g. from quick-add), still reviewed before saving. */
  draft?: Partial<TaskInput>
  onClose: () => void
  onSave: (input: TaskInput) => void
  saving?: boolean
}

export function TaskEditor({ open, task, draft, onClose, onSave, saving }: TaskEditorProps) {
  const isCreate = task === null
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [initialForm, setInitialForm] = useState<FormState>(EMPTY_FORM)
  const [attemptedSave, setAttemptedSave] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  useEffect(() => {
    if (!open) return
    const next = task
      ? taskToForm(task)
      : {
          ...EMPTY_FORM,
          ...(draft?.title ? { title: draft.title } : {}),
          ...(draft?.dueDate ? { dueDate: draft.dueDate } : {}),
          ...(draft?.priority ? { priority: draft.priority } : {}),
          ...(draft?.category ? { category: draft.category } : {}),
          ...(draft?.description ? { description: draft.description } : {}),
        }
    setForm(next)
    setInitialForm(next)
    setAttemptedSave(false)
  }, [open, task, draft])

  const titleError = form.title.trim() ? '' : 'Give the task a title.'
  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm)
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))
  const requestClose = () => (isDirty ? setConfirmDiscard(true) : onClose())

  const handleSave = () => {
    setAttemptedSave(true)
    if (titleError) return
    onSave({
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      dueDate: form.dueDate || undefined,
      priority: form.priority,
      category: form.category.trim() || undefined,
      status: form.status,
    })
  }

  return (
    <>
      <SlideOver
        busy={saving}
        open={open}
        onClose={requestClose}
        title={isCreate ? 'Add Task' : 'Edit Task'}
        subtitle="Something to get done"
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
              disabled={(!isCreate && !isDirty) || (attemptedSave && !!titleError)}
            >
              {isCreate ? 'Add Task' : 'Save Changes'}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-soft">Title</label>
            <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Pay electricity bill" />
            {attemptedSave && titleError && <p className="mt-1 text-[11px] text-danger">{titleError}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-soft">Due date (optional)</label>
              <Input type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
            </div>
            <ThemedSelect label="Priority" value={form.priority} options={PRIORITY_OPTIONS} onChange={(v) => set('priority', v as TaskPriority)} />
          </div>

          <ThemedSelect label="Status" value={form.status} options={STATUS_OPTIONS} onChange={(v) => set('status', v as TaskStatus)} />

          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-soft">Category (optional)</label>
            <Input value={form.category} onChange={(e) => set('category', e.target.value)} placeholder="e.g. Bills, Home" />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-soft">Description (optional)</label>
            <Input value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Any detail worth remembering" />
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
