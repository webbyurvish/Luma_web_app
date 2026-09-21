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
      {icon && <span className="pointer-events-none absolute left-3.5 text-ink-muted">{icon}</span>}
      <input
        ref={ref}
        className={cn(
          'h-10 w-full rounded-btn border border-border bg-card px-3.5 text-sm text-ink placeholder:text-ink-muted transition-colors focus:border-gold-dark focus:outline-none',
          icon && 'pl-10',
          className,
        )}
        {...props}
      />
    </div>
  )
})
