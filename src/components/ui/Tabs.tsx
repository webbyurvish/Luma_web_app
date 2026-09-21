import { cn } from '@/lib/cn'

interface TabsProps {
  tabs: { id: string; label: string }[]
  active: string
  onChange: (id: string) => void
  className?: string
}

export function Tabs({ tabs, active, onChange, className }: TabsProps) {
  return (
    <div className={cn('flex items-center gap-1 rounded-pill bg-bg-soft p-1', className)} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'rounded-pill px-3.5 py-1.5 text-xs font-medium transition-colors',
            active === tab.id ? 'bg-card text-ink shadow-xs' : 'text-ink-soft hover:text-ink',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
