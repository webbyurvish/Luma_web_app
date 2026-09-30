import { useState } from 'react'
import { Eye, EyeOff, Wand2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { generatePassword, passwordStrength } from '@/lib/vaultMeta'

interface SecretInputProps {
  id?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** Offers a strong random password. */
  generator?: boolean
  /** Shows the weak → strong meter under the field. */
  meter?: boolean
  inputMode?: 'numeric' | 'text'
  autoFocus?: boolean
  autoComplete?: string
  invalid?: boolean
  disabled?: boolean
  className?: string
}

const METER_COLORS = ['bg-border', 'bg-danger', 'bg-warning', 'bg-success/70', 'bg-success']

/** Password-style field: hidden by default, show/hide toggle, optional generator + strength meter. */
export function SecretInput({
  id,
  value,
  onChange,
  placeholder,
  generator,
  meter,
  inputMode,
  autoFocus,
  autoComplete = 'off',
  invalid,
  disabled,
  className,
}: SecretInputProps) {
  const [show, setShow] = useState(false)
  const strength = passwordStrength(value)

  return (
    <div className={className}>
      <div
        className={cn(
          'flex h-9 items-center rounded-sm border bg-surface pr-1 transition-colors focus-within:border-rust',
          invalid ? 'border-danger' : 'border-border hover:border-ink-soft/50',
        )}
      >
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          inputMode={inputMode}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          spellCheck={false}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          className="min-w-0 flex-1 bg-transparent px-3 font-mono-figure text-xs text-ink placeholder:font-sans placeholder:text-ink-muted focus:outline-none"
        />
        {generator && (
          <button
            type="button"
            onClick={() => {
              onChange(generatePassword())
              setShow(true)
            }}
            title="Generate a strong password"
            aria-label="Generate a strong password"
            className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-bg-soft hover:text-rust"
          >
            <Wand2 size={14} />
          </button>
        )}
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Hide' : 'Show'}
          className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-bg-soft hover:text-ink"
        >
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      {meter && value && (
        <div className="mt-1.5 flex items-center gap-2">
          <div className="flex flex-1 gap-1" aria-hidden>
            {[1, 2, 3, 4].map((n) => (
              <span key={n} className={cn('h-1 flex-1 rounded-full transition-colors', n <= strength.score ? METER_COLORS[strength.score] : 'bg-border-soft')} />
            ))}
          </div>
          <span className="w-12 text-right text-[10.5px] text-ink-muted">{strength.label}</span>
        </div>
      )}
    </div>
  )
}
