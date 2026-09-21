import { FileText } from 'lucide-react'
import { formatDate } from '@/lib/formatDate'
import type { AppDocument } from '@/types'

export function DocumentCard({ document }: { document: AppDocument }) {
  return (
    <div className="flex items-center gap-3 border border-border-soft bg-card px-3.5 py-3 transition-colors hover:bg-bg-soft">
      <FileText size={17} className="shrink-0 text-danger" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-ink">{document.name}</p>
        <p className="mt-0.5 text-[10px] uppercase tracking-[0.04em] text-ink-muted">
          {document.category} · {formatDate(document.date)} · {document.size}
        </p>
      </div>
    </div>
  )
}
