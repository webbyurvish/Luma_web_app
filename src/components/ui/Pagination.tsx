import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'

interface PaginationProps {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
}

export function Pagination({ page, pageCount, onPageChange }: PaginationProps) {
  if (pageCount <= 1) return null

  const pages = Array.from({ length: pageCount }, (_, i) => i + 1)

  return (
    <div className="flex items-center justify-between gap-3 pt-4">
      <button
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className="flex h-8 w-8 items-center justify-center rounded-btn border border-border text-ink-soft transition-colors hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Previous page"
      >
        <ChevronLeft size={15} />
      </button>
      <div className="flex items-center gap-1">
        {pages.map((p) => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            aria-current={p === page ? 'page' : undefined}
            className={cn(
              'h-7 w-7 rounded-sm font-mono-figure text-xs transition-colors',
              p === page ? 'bg-rust text-[#F6F1E7]' : 'text-ink-soft hover:bg-bg-soft',
            )}
          >
            {p}
          </button>
        ))}
      </div>
      <button
        onClick={() => onPageChange(Math.min(pageCount, page + 1))}
        disabled={page === pageCount}
        className="flex h-8 w-8 items-center justify-center rounded-btn border border-border text-ink-soft transition-colors hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Next page"
      >
        <ChevronRight size={15} />
      </button>
    </div>
  )
}
