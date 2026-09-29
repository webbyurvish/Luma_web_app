import { Archive, ExternalLink, FileText, Pencil, Trash2 } from 'lucide-react'
import { formatDate } from '@/lib/formatDate'
import type { AppDocument } from '@/types'

interface DocumentCardProps {
  document: AppDocument
  onEdit: (document: AppDocument) => void
  onArchive: (document: AppDocument) => void
  onDelete: (document: AppDocument) => void
}

export function DocumentCard({ document, onEdit, onArchive, onDelete }: DocumentCardProps) {
  const meta = [document.category, formatDate(document.date), document.fileType, document.size].filter(Boolean).join(' · ')

  return (
    <div className="group flex items-center gap-3 border border-border-soft bg-card px-3.5 py-3 transition-colors hover:bg-bg-soft">
      <FileText size={17} className="shrink-0 text-danger" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-ink">{document.name}</p>
        <p className="mt-0.5 truncate text-[10px] uppercase tracking-[0.04em] text-ink-muted">{meta}</p>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {document.url && /^https?:\/\//i.test(document.url) && (
          <a
            href={document.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${document.name}`}
            title="Open file"
            className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-card hover:text-rust"
          >
            <ExternalLink size={13} />
          </a>
        )}
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <button
            type="button"
            onClick={() => onEdit(document)}
            aria-label={`Edit ${document.name}`}
            className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-card hover:text-ink"
          >
            <Pencil size={13} />
          </button>
          <button
            type="button"
            onClick={() => onArchive(document)}
            aria-label={`Archive ${document.name}`}
            className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-warning-soft hover:text-warning"
          >
            <Archive size={13} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(document)}
            aria-label={`Delete ${document.name} permanently`}
            title="Delete permanently"
            className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-danger-soft hover:text-danger"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}
