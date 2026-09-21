import { NotebookText } from 'lucide-react'
import { formatFullDate } from '@/lib/formatDate'
import type { Note } from '@/types'

export function NoteCard({ note }: { note: Note }) {
  return (
    <button className="flex h-full flex-col items-start gap-3 rounded-card border border-border bg-card p-4 text-left shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-hover">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-warning-soft text-gold-dark">
        <NotebookText size={16} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-ink">{note.title}</p>
        <p className="mt-1.5 line-clamp-2 text-xs text-ink-soft">{note.excerpt}</p>
      </div>
      <p className="mt-auto text-[11px] text-ink-muted">Updated {formatFullDate(note.updatedAt)}</p>
    </button>
  )
}
