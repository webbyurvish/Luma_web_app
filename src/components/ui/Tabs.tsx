import { cn } from '@/lib/cn'

interface TabsProps {
  tabs: { id: string; label: string }[]
  active: string
  onChange: (id: string) => void
  className?: string
}

export function Tabs({ tabs, active, onChange, className }: TabsProps) {
  return (
    <div className={cn('flex items-center gap-5 border-b border-border-soft', className)} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'relative pb-2.5 text-xs font-medium uppercase tracking-[0.05em] transition-colors',
            active === tab.id ? 'text-ink' : 'text-ink-muted hover:text-ink-soft',
          )}
        >
          {tab.label}
          {active === tab.id && <span className="absolute inset-x-0 -bottom-px h-[2px] bg-rust" aria-hidden="true" />}
        </button>
      ))}
    </div>
  )
}
