import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

interface DocumentCategoryCardProps {
  name: string
  count: number
  icon: LucideIcon
  color: string
  active?: boolean
  onClick?: () => void
}

export function DocumentCategoryCard({ name, count, icon: Icon, color, active, onClick }: DocumentCategoryCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex items-center gap-2.5 border bg-card px-3 py-2.5 text-left transition-colors duration-150 hover:bg-bg-soft',
        active ? 'border-ink' : 'border-border-soft',
      )}
    >
      <Icon size={15} style={{ color }} className="shrink-0" />
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-ink">{name}</p>
        <p className="font-mono-figure text-[10px] text-ink-muted">{count} {count === 1 ? "document" : "documents"}</p>
      </div>
    </button>
  )
}
