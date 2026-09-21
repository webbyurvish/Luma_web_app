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
          'h-9 w-full appearance-none rounded-sm border border-border bg-surface pl-3 pr-8 text-xs text-ink transition-colors focus:border-rust focus:outline-none',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 text-ink-muted" />
    </div>
  )
}
