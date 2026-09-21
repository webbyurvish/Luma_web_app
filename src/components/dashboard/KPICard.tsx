import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/cn'

interface KPICardProps {
  label: string
  value: string
  trend: number
  trendLabel?: string
  icon: ReactNode
  accent: 'gold' | 'success' | 'danger' | 'ai'
}

const accentClasses: Record<KPICardProps['accent'], { iconBg: string; iconText: string }> = {
  gold: { iconBg: 'bg-warning-soft', iconText: 'text-gold-dark' },
  success: { iconBg: 'bg-success-soft', iconText: 'text-success' },
  danger: { iconBg: 'bg-danger-soft', iconText: 'text-danger' },
  ai: { iconBg: 'bg-ai-soft', iconText: 'text-ai' },
}

export function KPICard({ label, value, trend, trendLabel = 'vs last month', icon, accent }: KPICardProps) {
  const positive = trend >= 0
  const accentStyle = accentClasses[accent]

  return (
    <div className="animate-fade-up rounded-card border border-border bg-card p-5 shadow-card transition-shadow duration-300 hover:shadow-hover">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-ink-soft">{label}</p>
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-full', accentStyle.iconBg, accentStyle.iconText)}>
          {icon}
        </div>
      </div>
      <p className="mt-3.5 text-[28px] font-bold leading-none text-ink sm:text-[30px]">{value}</p>
      <div className="mt-3 flex items-center gap-1.5 text-xs">
        <span className={cn('flex items-center gap-0.5 font-medium', positive ? 'text-success' : 'text-danger')}>
          {positive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
          {Math.abs(trend)}%
        </span>
        <span className="text-ink-muted">{trendLabel}</span>
      </div>
    </div>
  )
}
