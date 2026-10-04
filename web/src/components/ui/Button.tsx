import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'
import { Spinner } from './Loader'

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
  /** Swaps the icon for a spinner, disables the button and marks it aria-busy. */
  loading?: boolean
  /** Label shown while `loading` (e.g. "Saving…"); defaults to the normal children. */
  loadingText?: ReactNode
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-rust text-on-accent hover:bg-rust-dark',
  secondary: 'bg-transparent text-ink border border-border hover:bg-bg-soft',
  ghost: 'bg-transparent text-ink-soft hover:bg-bg-soft hover:text-ink',
  danger: 'bg-danger text-on-accent hover:opacity-90',
}

const sizeClasses: Record<ButtonSize, string> = {
  // Touch screens get a taller small button (36px) — easier to hit with a thumb.
  sm: 'h-7 pointer-coarse:h-9 px-2.5 pointer-coarse:px-3 text-[11px] gap-1.5',
  md: 'h-9 px-3.5 text-xs gap-1.5',
  lg: 'h-11 px-5 text-sm gap-2',
}

const spinnerSize: Record<ButtonSize, number> = { sm: 12, md: 13, lg: 15 }

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  loading = false,
  loadingText,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <motion.button
      whileTap={loading ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.1 }}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center rounded-btn font-medium uppercase tracking-[0.04em] transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50',
        // A loading button is disabled but shouldn't look "unavailable" — it's working.
        loading && 'disabled:cursor-wait disabled:opacity-90',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {loading ? (
        <Spinner size={spinnerSize[size]} />
      ) : (
        icon && iconPosition === 'left' && <span className="shrink-0 normal-case">{icon}</span>
      )}
      {loading && loadingText ? loadingText : children}
      {!loading && icon && iconPosition === 'right' && <span className="shrink-0 normal-case">{icon}</span>}
    </motion.button>
  )
}
