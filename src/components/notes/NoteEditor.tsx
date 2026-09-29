import { useEffect, useState } from 'react'
import { SlideOver } from '@/components/ui/SlideOver'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/Button'
import { ThemedSelect } from '@/components/ui/ThemedSelect'
import { Input } from '@/components/ui/Input'
import type { NoteCategoryDef } from '@/data/mockNotes'
import type { Note, NoteInput } from '@/types'

interface FormState {
  title: string
  content: string
  category: string
  tagsInput: string
}

const EMPTY_FORM: FormState = { title: '', content: '', category: '', tagsInput: '' }

function noteToForm(note: Note): FormState {
  return { title: note.title, content: note.content, category: note.category, tagsInput: note.tags.join(', ') }
}

function parseTags(input: string): string[] {
  return input
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

interface NoteEditorProps {
  open: boolean
  note: Note | null
  categories: NoteCategoryDef[]
  onClose: () => void
  onSave: (input: NoteInput) => void
  /** True while the create/update request is in flight — disables Save and prevents double submission. */
  saving?: boolean
}

export function NoteEditor({ open, note, categories, onClose, onSave, saving }: NoteEditorProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [initialForm, setInitialForm] = useState<FormState>(EMPTY_FORM)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [attemptedSave, setAttemptedSave] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  useEffect(() => {
    if (!open) return
    const next = note ? noteToForm(note) : EMPTY_FORM
    setForm(next)
    setInitialForm(next)
    setTouched({})
    setAttemptedSave(false)
  }, [open, note])

  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm)
  const errors = {
    title: form.title.trim() ? '' : 'Title is required.',
    content: form.content.trim() ? '' : 'Content is required.',
    category: form.category ? '' : 'Category is required.',
  }
  const isValid = !errors.title && !errors.content && !errors.category

  const requestClose = () => {
    if (isDirty) {
      setConfirmDiscard(true)
    } else {
      onClose()
    }
  }

  const handleSave = () => {
    setAttemptedSave(true)
    if (!isValid) return
    onSave({ title: form.title.trim(), content: form.content.trim(), category: form.category, tags: parseTags(form.tagsInput) })
  }

  const showError = (field: keyof typeof errors) => (touched[field] || attemptedSave) && errors[field]

  return (
    <>
      <SlideOver
        busy={saving}
        open={open}
        onClose={requestClose}
        title={note ? 'Edit Note' : 'New Note'}
        subtitle={note ? 'Update the details below' : 'Keep something important organized'}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={requestClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={handleSave} loading={saving} loadingText="Saving…" disabled={attemptedSave && !isValid}>
              Save Note
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-soft">Title</label>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              onBlur={() => setTouched((t) => ({ ...t, title: true }))}
              placeholder="e.g. Car Information"
            />
            {showError('title') && <p className="mt-1 text-[11px] text-danger">{errors.title}</p>}
          </div>

          <ThemedSelect
            label="Category"
            required
            value={form.category}
            options={categories.map((cat) => ({ value: cat.id, label: cat.name }))}
            placeholder="Select category"
            onChange={(next) => setForm((f) => ({ ...f, category: next }))}
            onBlur={() => setTouched((t) => ({ ...t, category: true }))}
            error={showError('category') || undefined}
          />

          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-soft">Tags</label>
            <Input
              value={form.tagsInput}
              onChange={(e) => setForm((f) => ({ ...f, tagsInput: e.target.value }))}
              placeholder="comma, separated, tags (optional)"
            />
          </div>

          <div className="flex flex-1 flex-col">
            <label className="mb-1.5 block text-xs font-medium text-ink-soft">Content</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              onBlur={() => setTouched((t) => ({ ...t, content: true }))}
              placeholder="Write everything worth remembering here..."
              rows={12}
              className="min-h-[240px] w-full flex-1 resize-none rounded-sm border border-border bg-surface px-3 py-2.5 text-sm leading-relaxed text-ink placeholder:text-ink-muted transition-colors focus:border-rust focus:outline-none"
            />
            {showError('content') && <p className="mt-1 text-[11px] text-danger">{errors.content}</p>}
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
