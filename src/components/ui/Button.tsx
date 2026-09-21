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
  primary: 'bg-rust text-[#F6F1E7] hover:bg-rust-dark',
  secondary: 'bg-transparent text-ink border border-border hover:bg-bg-soft',
  ghost: 'bg-transparent text-ink-soft hover:bg-bg-soft hover:text-ink',
  danger: 'bg-danger text-[#F6F1E7] hover:opacity-90',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 text-[11px] gap-1.5',
  md: 'h-9 px-3.5 text-xs gap-1.5',
  lg: 'h-11 px-5 text-sm gap-2',
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
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.1 }}
      className={cn(
        'inline-flex items-center justify-center rounded-btn font-medium uppercase tracking-[0.04em] transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {icon && iconPosition === 'left' && <span className="shrink-0 normal-case">{icon}</span>}
      {children}
      {icon && iconPosition === 'right' && <span className="shrink-0 normal-case">{icon}</span>}
    </motion.button>
  )
}
