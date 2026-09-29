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

      <div className="absolute right-3 top-3 flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onEdit(note)
          }}
          aria-label={`Edit ${note.title}`}
          className="rounded-xs p-1.5 text-ink-muted transition-colors hover:bg-card hover:text-ink"
        >
          <Pencil size={13} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onArchive(note)
          }}
          aria-label={`Archive ${note.title}`}
          className="rounded-xs p-1.5 text-ink-muted transition-colors hover:bg-card hover:text-warning"
        >
          <Archive size={13} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete(note)
          }}
          aria-label={`Delete ${note.title} permanently`}
          title="Delete permanently"
          className="rounded-xs p-1.5 text-ink-muted transition-colors hover:bg-card hover:text-danger"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}
