import { useEffect, useState } from 'react'
import { AlertTriangle, Trash2 } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from './Button'
import { Input } from './Input'

const CONFIRM_WORD = 'DELETE'

interface DeleteRecordDialogProps {
  open: boolean
  /** e.g. "account", "transaction" */
  recordType: string
  /** The record's display name, shown in quotes. */
  recordName?: string
  /** When set, deletion isn't allowed — the reason is shown instead of the confirm field. */
  blockedReason?: string | null
  /** Offered as the gentler alternative, e.g. "Archive". Omit when the record has none. */
  softActionLabel?: string
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Permanent-delete confirmation. Deliberately heavier than ConfirmDialog: the user types
 * DELETE, and the copy explains the sheet row is removed (with a copy kept in the
 * "Deleted Records" sheet) and points to the reversible alternative.
 */
export function DeleteRecordDialog({
  open,
  recordType,
  recordName,
  blockedReason,
  softActionLabel,
  loading = false,
  onConfirm,
  onCancel,
}: DeleteRecordDialogProps) {
  const [typed, setTyped] = useState('')

  useEffect(() => {
    if (open) setTyped('')
  }, [open])

  const confirmed = typed.trim().toUpperCase() === CONFIRM_WORD

  return (
    <Modal open={open} onClose={onCancel} title={`Delete ${recordType} permanently?`} className="max-w-sm" busy={loading}>
      {blockedReason ? (
        <>
          <div className="flex gap-2.5 rounded-btn border border-warning/30 bg-warning-soft px-3 py-2.5 text-xs leading-relaxed text-ink">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-warning" />
            <p>{blockedReason}</p>
          </div>
          <div className="mt-5 flex justify-end">
            <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
              Got it
            </Button>
          </div>
        </>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (confirmed && !loading) onConfirm()
          }}
        >
          <p className="text-xs leading-relaxed text-ink-soft">
            {recordName ? (
              <>
                <span className="font-medium text-ink">"{recordName}"</span> will be removed from your sheet and every total.
              </>
            ) : (
              <>This {recordType} will be removed from your sheet and every total.</>
            )}{' '}
            You can't undo this from the app, but a copy is kept in the <span className="font-medium text-ink">Deleted Records</span> sheet.
          </p>
          {softActionLabel && (
            <p className="mt-2 text-xs leading-relaxed text-ink-muted">
              Just want it out of sight? Use <span className="font-medium text-ink-soft">{softActionLabel}</span> instead. That one is reversible.
            </p>
          )}

          <label className="mt-4 mb-1.5 block text-xs font-medium text-ink-soft">
            Type <span className="font-mono-figure font-bold text-danger">{CONFIRM_WORD}</span> to confirm
          </label>
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={CONFIRM_WORD} autoComplete="off" disabled={loading} />

          <div className="mt-5 flex items-center justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onCancel} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              size="sm"
              icon={<Trash2 size={12} />}
              disabled={!confirmed}
              loading={loading}
              loadingText="Deleting…"
            >
              Delete forever
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
