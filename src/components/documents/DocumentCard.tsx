import { FileText } from 'lucide-react'
import { formatFullDate } from '@/lib/formatDate'
import type { AppDocument } from '@/types'

export function DocumentCard({ document }: { document: AppDocument }) {
  return (
    <div className="flex items-center gap-3.5 rounded-card border border-border bg-card p-4 shadow-card transition-shadow duration-200 hover:shadow-hover">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-btn bg-danger-soft text-danger">
        <FileText size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{document.name}</p>
        <p className="mt-0.5 text-xs text-ink-soft">
          {document.category} · {formatFullDate(document.date)} · {document.size}
        </p>
      </div>
    </div>
  )
}
