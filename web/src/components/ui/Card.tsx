import type { HTMLAttributes, ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cardHover } from '@/lib/motion'
import { cn } from '@/lib/cn'

type CardVariant = 'standard' | 'flat' | 'panel' | 'inset'

type MotionSafeDivAttributes = Omit<
  HTMLAttributes<HTMLDivElement>,
  'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart' | 'onAnimationEnd'
>

interface CardProps extends MotionSafeDivAttributes {
  hoverable?: boolean
  variant?: CardVariant
}

const variantClasses: Record<CardVariant, string> = {
  standard: 'rounded-card border border-border-soft bg-card p-4',
  flat: 'bg-transparent p-0',
  panel: 'rounded-hero border border-border bg-surface p-5',
  inset: 'rounded-card border border-border-soft bg-bg-soft p-4',
}

export function Card({ hoverable, variant = 'standard', className, children, ...props }: CardProps) {
  if (hoverable) {
    return (
      <motion.div
        initial="rest"
        whileHover="hover"
        variants={cardHover}
        className={cn(variantClasses[variant], className)}
        {...props}
      >
        {children}
      </motion.div>
    )
  }

  return (
    <div className={cn(variantClasses[variant], className)} {...props}>
      {children}
    </div>
  )
}

interface CardHeaderProps {
  title: string
  subtitle?: string
  action?: ReactNode
  icon?: ReactNode
}

export function CardHeader({ title, subtitle, action, icon }: CardHeaderProps) {
  return (
    <div className="mb-3.5 flex items-start justify-between gap-3">
      <div className="flex items-start gap-2.5">
        {icon && <div className="shrink-0 pt-0.5">{icon}</div>}
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
