import { type InputHTMLAttributes, type ReactNode, forwardRef } from 'react'
import { cn } from '@/lib/cn'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { icon, className, ...props },
  ref,
) {
  return (
    <div className="relative flex items-center">
      {icon && <span className="pointer-events-none absolute left-3 text-ink-muted">{icon}</span>}
      <input
        ref={ref}
        className={cn(
          'h-9 w-full rounded-sm border border-border bg-surface px-3 text-xs text-ink placeholder:text-ink-muted transition-colors duration-150 hover:border-ink-soft/50 focus:border-rust focus:outline-none',
          icon && 'pl-9',
          className,
        )}
        {...props}
      />
    </div>
  )
})
