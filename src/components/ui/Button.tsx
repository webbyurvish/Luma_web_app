import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

type MotionSafeButtonAttributes = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart' | 'onAnimationEnd'
>

interface ButtonProps extends MotionSafeButtonAttributes {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: ReactNode
  iconPosition?: 'left' | 'right'
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-gradient-gold text-ink shadow-xs hover:shadow-gold',
  secondary: 'bg-card text-ink border border-border hover:bg-bg-soft',
  ghost: 'bg-transparent text-ink-soft hover:bg-bg-soft hover:text-ink',
  danger: 'bg-danger text-white hover:opacity-90',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-sm gap-2',
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.12 }}
      className={cn(
        'inline-flex items-center justify-center rounded-btn font-medium transition-[box-shadow,background-color,opacity] duration-200 disabled:cursor-not-allowed disabled:opacity-50',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {icon && iconPosition === 'left' && <span className="shrink-0">{icon}</span>}
      {children}
      {icon && iconPosition === 'right' && <span className="shrink-0">{icon}</span>}
    </motion.button>
  )
}
