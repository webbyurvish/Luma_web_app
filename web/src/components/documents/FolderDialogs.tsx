import { type ReactNode, useEffect, useState } from 'react'
import { ChevronRight, Folder, Library } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/cn'
import type { DriveFolder } from '@/types'

/* ------------------------------------------------------------ name dialog */

interface FolderNameDialogProps {
  open: boolean
  title: string
  subtitle?: string
  initialName?: string
  confirmLabel: string
  saving?: boolean
  onConfirm: (name: string) => void
  onCancel: () => void
}

export function FolderNameDialog({ open, title, subtitle, initialName = '', confirmLabel, saving, onConfirm, onCancel }: FolderNameDialogProps) {
  const [name, setName] = useState(initialName)
  useEffect(() => {
    if (open) setName(initialName)
  }, [open, initialName])
  const valid = name.trim().length > 0 && name.trim() !== initialName

  return (
    <Modal open={open} onClose={onCancel} title={title} subtitle={subtitle} className="max-w-sm" busy={saving}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (valid && !saving) onConfirm(name.trim())
        }}
      >
        <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Folder name" maxLength={120} />
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={!valid} loading={saving} loadingText="Saving…">
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/* ----------------------------------------------------------- folder picker */

interface FolderPickerProps {
  open: boolean
  title: string
  rootId: string
  childFolders: Map<string, DriveFolder[]>
  /** Folders that can't be chosen (the item's own folder; a folder itself and everything inside it). */
  disabledIds: Set<string>
  saving?: boolean
  onPick: (folderId: string) => void
  onCancel: () => void
}

export function FolderPickerDialog({ open, title, rootId, childFolders, disabledIds, saving, onPick, onCancel }: FolderPickerProps) {
  const [selected, setSelected] = useState<string | null>(null)
  useEffect(() => {
    if (open) setSelected(null)
  }, [open])

  const renderLevel = (parentId: string, depth: number) =>
    (childFolders.get(parentId) ?? []).map((folder) => {
      const disabled = disabledIds.has(folder.id)
      return (
        <div key={folder.id}>
          <PickRow label={folder.name} depth={depth} disabled={disabled} selected={selected === folder.id} onSelect={() => setSelected(folder.id)} icon={<Folder size={13} />} />
          {renderLevel(folder.id, depth + 1)}
        </div>
      )
    })

  return (
    <Modal open={open} onClose={onCancel} title={title} subtitle="Choose where it should go" className="max-w-md" busy={saving}>
      <div className="max-h-[320px] overflow-y-auto rounded-btn border border-border-soft p-1">
        <PickRow label="Luma Documents" depth={0} disabled={disabledIds.has(rootId)} selected={selected === rootId} onSelect={() => setSelected(rootId)} icon={<Library size={13} />} />
        {renderLevel(rootId, 1)}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="button" size="sm" disabled={!selected} loading={saving} loadingText="Moving…" onClick={() => selected && onPick(selected)}>
          Move here
        </Button>
      </div>
    </Modal>
  )
}

function PickRow({ label, depth, disabled, selected, onSelect, icon }: { label: string; depth: number; disabled: boolean; selected: boolean; onSelect: () => void; icon: ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      aria-pressed={selected}
      style={{ paddingLeft: `${8 + depth * 14}px` }}
      className={cn(
        'flex w-full items-center gap-2 rounded-xs py-1.5 pr-2 text-left text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        selected ? 'bg-ink text-paper' : 'text-ink hover:bg-bg-soft',
      )}
    >
      {depth > 0 && <ChevronRight size={10} className="shrink-0 opacity-40" />}
      <span className={selected ? 'text-paper' : 'text-rust/80'}>{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  )
}
