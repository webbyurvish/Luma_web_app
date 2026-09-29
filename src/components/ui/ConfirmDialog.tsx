import { Modal } from './Modal'
import { Button } from './Button'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  /** While true the confirm button spins, Cancel is disabled and the dialog can't be dismissed. */
  loading?: boolean
  /** Confirm label shown while `loading`, e.g. "Archiving…". */
  loadingLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  destructive = true,
  loading = false,
  loadingLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} title={title} className="max-w-sm" busy={loading}>
      <p className="text-xs leading-relaxed text-ink-soft">{description}</p>
      <div className="mt-5 flex items-center justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button
          type="button"
          variant={destructive ? 'danger' : 'primary'}
          size="sm"
          onClick={onConfirm}
          loading={loading}
          loadingText={loadingLabel}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
