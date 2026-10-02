import { cn } from '@/lib/cn'

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  /** Accessible name (not shown). */
  label?: string
  disabled?: boolean
}

/**
 * The knob is a flex child moved with justify-content — never absolutely positioned inside the
 * <button>: Safari (iPhone) centres absolute children of buttons, which threw the knob off.
 * The border is the same in both states so nothing shifts by a pixel when it flips.
 */
export function Switch({ checked, onChange, label, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="group relative inline-flex h-11 w-[52px] shrink-0 cursor-pointer items-center justify-center rounded-pill disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span
        aria-hidden="true"
        className={cn(
          'flex h-[26px] w-[46px] items-center rounded-pill border p-[2px] transition-colors duration-200',
          checked ? 'justify-end border-rust bg-rust' : 'justify-start border-border bg-bg-soft',
        )}
      >
        <span className="block h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(27,26,23,0.25)] transition-transform duration-200 group-active:scale-95" />
      </span>
    </button>
  )
}
