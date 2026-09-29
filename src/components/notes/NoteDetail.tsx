import { Archive, Pencil } from 'lucide-react'
import { SlideOver } from '@/components/ui/SlideOver'
import { Button } from '@/components/ui/Button'
import { formatFullDate } from '@/lib/formatDate'
import type { NoteCategoryDef } from '@/data/mockNotes'
import type { Note } from '@/types'

interface NoteDetailProps {
  open: boolean
  note: Note | null
  categories: NoteCategoryDef[]
  onClose: () => void
  onEdit: (note: Note) => void
  onArchive: (note: Note) => void
}

export function NoteDetail({ open, note, categories, onClose, onEdit, onArchive }: NoteDetailProps) {
  const categoryName = note ? categories.find((cat) => cat.id === note.category)?.name ?? note.category : ''

  return (
    <SlideOver
      open={open && note !== null}
      onClose={onClose}
      title={note?.title ?? ''}
      subtitle={categoryName}
      footer={
        note && (
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="danger" size="sm" icon={<Archive size={13} />} onClick={() => onArchive(note)}>
              Archive
            </Button>
            <Button type="button" size="sm" icon={<Pencil size={13} />} onClick={() => onEdit(note)}>
              Edit
            </Button>
          </div>
        )
      }
    >
      {note && (
        <div className="flex flex-col gap-4">
          {note.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {note.tags.map((tag) => (
                <span key={tag} className="rounded-xs border border-border-soft px-1.5 py-0.5 text-[10px] uppercase tracking-[0.04em] text-ink-soft">
                  {tag}
                </span>
              ))}
            </div>
          )}

          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{note.content}</p>

          <div className="mt-2 flex items-center gap-4 border-t border-border-soft pt-3 text-[10px] text-ink-muted">
            <span>Created {formatFullDate(note.createdAt)}</span>
            <span>Updated {formatFullDate(note.updatedAt)}</span>
          </div>
        </div>
      )}
    </SlideOver>
  )
}
