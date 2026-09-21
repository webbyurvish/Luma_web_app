import type { ReactNode, SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  children: ReactNode
}

export function Select({ className, children, ...props }: SelectProps) {
  return (
    <div className="relative flex items-center">
      <select
        className={cn(
          'h-10 w-full appearance-none rounded-btn border border-border bg-card pl-3.5 pr-9 text-sm text-ink transition-colors focus:border-gold-dark focus:outline-none',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute right-3 text-ink-muted" />
    </div>
  )
}
