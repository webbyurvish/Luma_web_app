import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface StatCardProps {
  label: string
  value: string
  icon: ReactNode
  accent?: 'gold' | 'success' | 'danger' | 'ai' | 'info'
}

const accentClasses: Record<NonNullable<StatCardProps['accent']>, { bg: string; text: string }> = {
  gold: { bg: 'bg-warning-soft', text: 'text-gold-dark' },
  success: { bg: 'bg-success-soft', text: 'text-success' },
  danger: { bg: 'bg-danger-soft', text: 'text-danger' },
  ai: { bg: 'bg-ai-soft', text: 'text-ai' },
  info: { bg: 'bg-info-soft', text: 'text-info' },
}

export function StatCard({ label, value, icon, accent = 'gold' }: StatCardProps) {
  const style = accentClasses[accent]
  return (
    <div className="rounded-card border border-border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-ink-soft">{label}</p>
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-full', style.bg, style.text)}>{icon}</div>
      </div>
      <p className="mt-3.5 text-2xl font-bold text-ink sm:text-[26px]">{value}</p>
    </div>
  )
}
