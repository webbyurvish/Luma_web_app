import { NotebookText } from 'lucide-react'
import { formatDate } from '@/lib/formatDate'
import type { Note } from '@/types'

export function NoteCard({ note }: { note: Note }) {
  return (
    <button className="flex h-full flex-col items-start gap-2.5 border border-border-soft bg-card p-3.5 text-left transition-colors duration-150 hover:bg-bg-soft">
      <NotebookText size={15} className="text-rust" />
      <div className="min-w-0">
        <p className="truncate font-display text-sm italic text-ink">{note.title}</p>
        <p className="mt-1 line-clamp-2 text-xs text-ink-soft">{note.excerpt}</p>
      </div>
      <p className="mt-auto font-mono-figure text-[10px] text-ink-muted">Updated {formatDate(note.updatedAt)}</p>
    </button>
  )
}
