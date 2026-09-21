import type { HTMLAttributes, ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cardHover } from '@/lib/motion'
import { cn } from '@/lib/cn'

type CardVariant = 'standard' | 'tint' | 'glass' | 'flat'

type MotionSafeDivAttributes = Omit<
  HTMLAttributes<HTMLDivElement>,
  'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart' | 'onAnimationEnd'
>

interface CardProps extends MotionSafeDivAttributes {
  hoverable?: boolean
  variant?: CardVariant
}

const variantClasses: Record<CardVariant, string> = {
  standard: 'border border-border bg-card shadow-card',
  tint: 'border border-border-soft shadow-xs',
  glass: 'glass-surface shadow-card',
  flat: 'bg-transparent',
}

export function Card({ hoverable, variant = 'standard', className, children, ...props }: CardProps) {
  if (hoverable) {
    return (
      <motion.div
        initial="rest"
        whileHover="hover"
        variants={cardHover}
        className={cn('rounded-card p-5', variantClasses[variant], className)}
        {...props}
      >
        {children}
      </motion.div>
    )
  }

  return (
    <div className={cn('rounded-card p-5', variantClasses[variant], className)} {...props}>
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
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        {icon && <div className="shrink-0">{icon}</div>}
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-ink">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-ink-soft">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
