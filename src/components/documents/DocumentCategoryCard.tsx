import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

interface DocumentCategoryCardProps {
  name: string
  count: number
  icon: LucideIcon
  color: string
  bg: string
  active?: boolean
  onClick?: () => void
}

export function DocumentCategoryCard({ name, count, icon: Icon, color, bg, active, onClick }: DocumentCategoryCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-start gap-3 rounded-card border bg-card p-4 text-left shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-hover',
        active ? 'border-gold-dark ring-1 ring-gold-dark' : 'border-border',
      )}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: bg, color }}>
        <Icon size={18} />
      </span>
      <div>
        <p className="text-sm font-semibold text-ink">{name}</p>
        <p className="text-xs text-ink-soft">{count} files</p>
      </div>
    </button>
  )
}
