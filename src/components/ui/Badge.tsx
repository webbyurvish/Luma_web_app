import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export type BadgeVariant = 'success' | 'danger' | 'warning' | 'info' | 'ai' | 'neutral'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

const variantClasses: Record<BadgeVariant, string> = {
  success: 'text-success border-success/30 bg-success-soft',
  danger: 'text-danger border-danger/30 bg-danger-soft',
  warning: 'text-warning border-warning/30 bg-warning-soft',
  info: 'text-ai border-ai/25 bg-ai-soft',
  ai: 'text-ai border-ai/25 bg-ai-soft',
  neutral: 'text-ink-soft border-border bg-bg-soft',
}

export function Badge({ variant = 'neutral', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-xs border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.05em]',
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}
