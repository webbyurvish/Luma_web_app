import { RowActions } from '@/components/ui/RowActions'
import { Archive, NotebookText, Pencil, Trash2 } from 'lucide-react'
import { formatDate } from '@/lib/formatDate'
import type { Note } from '@/types'

interface NoteCardProps {
  note: Note
  onView: (note: Note) => void
  onEdit: (note: Note) => void
  onArchive: (note: Note) => void
  onDelete: (note: Note) => void
}

export function NoteCard({ note, onView, onEdit, onArchive, onDelete }: NoteCardProps) {
  const excerpt = note.content.replace(/\n+/g, ' ').slice(0, 110)

  return (
    <div className="group relative flex h-full flex-col items-start gap-2.5 border border-border-soft bg-card p-3.5 text-left transition-colors duration-150 hover:bg-bg-soft">
      <button onClick={() => onView(note)} className="flex w-full flex-1 flex-col items-start gap-2.5 text-left" aria-label={`View ${note.title}`}>
        <NotebookText size={15} className="text-rust" />
        <div className="min-w-0 w-full pr-12">
          <p className="truncate font-display text-sm italic text-ink">{note.title}</p>
          <p className="mt-1 line-clamp-2 text-xs text-ink-soft">
            {excerpt}
            {note.content.length > 110 ? '…' : ''}
          </p>
        </div>
        <p className="mt-auto font-mono-figure text-[10px] text-ink-muted">Updated {formatDate(note.updatedAt)}</p>
      </button>

      <RowActions
        className="absolute right-2 top-2"
        label={`Actions for ${note.title}`}
        actions={[
          { label: 'Edit', ariaLabel: `Edit ${note.title}`, icon: <Pencil size={13} />, onClick: () => onEdit(note) },
          { label: 'Archive', ariaLabel: `Archive ${note.title}`, icon: <Archive size={13} />, onClick: () => onArchive(note), tone: 'warning' },
          { label: 'Delete', ariaLabel: `Delete ${note.title} permanently`, icon: <Trash2 size={13} />, onClick: () => onDelete(note), tone: 'danger' },
        ]}
      />
    </div>
  )
}
