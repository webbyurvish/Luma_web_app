import { useEffect, useState } from 'react'
import { SlideOver } from '@/components/ui/SlideOver'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ThemedSelect } from '@/components/ui/ThemedSelect'
import { DOCUMENT_CATEGORIES, type AppDocument, type DocumentCategory, type DocumentInput } from '@/types'

interface FormState {
  name: string
  category: DocumentCategory | ''
  url: string
  fileType: string
  description: string
  tags: string
}

const EMPTY_FORM: FormState = { name: '', category: '', url: '', fileType: '', description: '', tags: '' }
const CATEGORY_OPTIONS = DOCUMENT_CATEGORIES.map((c) => ({ value: c, label: c }))

function documentToForm(doc: AppDocument): FormState {
  return { name: doc.name, category: doc.category, url: doc.url ?? '', fileType: doc.fileType ?? '', description: doc.description ?? '', tags: doc.tags ?? '' }
}

/** Only http(s) links, so a pasted `javascript:` or similar can never become a clickable href. */
const isSafeUrl = (value: string) => /^https?:\/\/\S+$/i.test(value.trim())

interface DocumentEditorProps {
  open: boolean
  /** The document to edit; null opens in "add new" mode. */
  document: AppDocument | null
  onClose: () => void
  onSave: (input: DocumentInput) => void
  saving?: boolean
}

export function DocumentEditor({ open, document, onClose, onSave, saving }: DocumentEditorProps) {
  const isCreate = document === null
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [initialForm, setInitialForm] = useState<FormState>(EMPTY_FORM)
  const [attemptedSave, setAttemptedSave] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  useEffect(() => {
    if (!open) return
    const next = document ? documentToForm(document) : EMPTY_FORM
    setForm(next)
    setInitialForm(next)
    setAttemptedSave(false)
  }, [open, document])

  const errors = {
    name: form.name.trim() ? '' : 'Give the document a name.',
    category: form.category ? '' : 'Pick a category.',
    url: !form.url.trim() || isSafeUrl(form.url) ? '' : 'Paste a full link starting with https://',
  }
  const isValid = !errors.name && !errors.category && !errors.url
  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm)
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))
  const requestClose = () => (isDirty ? setConfirmDiscard(true) : onClose())

  const handleSave = () => {
    setAttemptedSave(true)
    if (!isValid || !form.category) return
    onSave({
      name: form.name.trim(),
      category: form.category,
      url: form.url.trim() || undefined,
      fileType: form.fileType.trim() || undefined,
      description: form.description.trim() || undefined,
      tags: form.tags.trim() || undefined,
    })
  }

  return (
    <>
      <SlideOver
        busy={saving}
        open={open}
        onClose={requestClose}
        title={isCreate ? 'Add Document' : 'Edit Document'}
        subtitle="Keep a record and a link to the file"
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
              {isCreate ? 'Add Document' : 'Save Changes'}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-soft">Name</label>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Health insurance policy 2026" />
            {attemptedSave && errors.name && <p className="mt-1 text-[11px] text-danger">{errors.name}</p>}
          </div>

          <ThemedSelect
            label="Category"
            required
            value={form.category}
            options={CATEGORY_OPTIONS}
            placeholder="Select category"
            onChange={(v) => set('category', v as DocumentCategory)}
            error={(attemptedSave && errors.category) || undefined}
          />

          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-soft">Link to file (optional)</label>
            <Input value={form.url} onChange={(e) => set('url', e.target.value)} placeholder="https://drive.google.com/…" inputMode="url" />
            {(attemptedSave || form.url) && errors.url ? (
              <p className="mt-1 text-[11px] text-danger">{errors.url}</p>
            ) : (
              <p className="mt-1 text-[10.5px] text-ink-muted">Upload the file to Google Drive, then paste its share link here.</p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-soft">File type (optional)</label>
            <Input value={form.fileType} onChange={(e) => set('fileType', e.target.value)} placeholder="e.g. PDF" />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-soft">Description (optional)</label>
            <Input value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="What is this document?" />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-soft">Tags (optional)</label>
            <Input value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="Comma separated, e.g. tax, 2026" />
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
