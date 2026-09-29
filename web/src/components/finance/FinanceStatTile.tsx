import { cn } from '@/lib/cn'

interface FinanceStatTileProps {
  label: string
  value: string
  onClick?: () => void
}

export function FinanceStatTile({ label, value, onClick }: FinanceStatTileProps) {
  const className = cn(
    'rounded-sm border border-border-soft bg-surface px-3.5 py-3 text-left transition-colors duration-150',
    onClick && 'hover:border-ink-soft hover:bg-bg-soft',
  )

  const content = (
    <>
      <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-muted">{label}</p>
      <p className="mt-1 font-mono-figure text-lg font-bold text-ink">{value}</p>
    </>
  )

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    )
  }

  return <div className={className}>{content}</div>
}
