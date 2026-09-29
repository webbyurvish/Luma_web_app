import { type KeyboardEvent, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface ThemedSelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface MenuStyle {
  position: 'fixed'
  top?: number
  bottom?: number
  left: number
  width: number
}

interface ThemedSelectProps {
  label?: string
  value: string
  options: ThemedSelectOption[]
  placeholder?: string
  onChange: (value: string) => void
  onBlur?: () => void
  disabled?: boolean
  error?: string
  required?: boolean
  id?: string
  className?: string
  'aria-label'?: string
}

const MENU_GAP = 4
const OPTION_HEIGHT = 32
const MENU_PADDING = 8
const MAX_MENU_HEIGHT = 264

export function ThemedSelect({
  label,
  value,
  options,
  placeholder = 'Select...',
  onChange,
  onBlur,
  disabled,
  error,
  required,
  id,
  className,
  'aria-label': ariaLabel,
}: ThemedSelectProps) {
  const generatedId = useId()
  const controlId = id ?? generatedId
  const listboxId = `${controlId}-listbox`

  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)

  const [open, setOpen] = useState(false)
  const [placement, setPlacement] = useState<'bottom' | 'top'>('bottom')
  const [menuStyle, setMenuStyle] = useState<MenuStyle | null>(null)
  const [highlightedIndex, setHighlightedIndex] = useState(0)

  const selectedOption = options.find((option) => option.value === value) ?? null

  const openMenu = () => {
    if (disabled || options.length === 0) return
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const menuHeight = Math.min(options.length * OPTION_HEIGHT + MENU_PADDING, MAX_MENU_HEIGHT)
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    const nextPlacement: 'bottom' | 'top' = spaceBelow < menuHeight && spaceAbove > spaceBelow ? 'top' : 'bottom'

    setPlacement(nextPlacement)
    setMenuStyle({
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      ...(nextPlacement === 'bottom' ? { top: rect.bottom + MENU_GAP } : { bottom: window.innerHeight - rect.top + MENU_GAP }),
    })

    const selectedIndex = options.findIndex((option) => option.value === value)
    const fallbackIndex = options.findIndex((option) => !option.disabled)
    setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : Math.max(fallbackIndex, 0))
    setOpen(true)
  }

  const closeMenu = () => setOpen(false)

  const selectOption = (option: ThemedSelectOption) => {
    if (option.disabled) return
    onChange(option.value)
    setOpen(false)
    triggerRef.current?.focus()
  }

  const stepHighlighted = (direction: 1 | -1) => {
    setHighlightedIndex((current) => {
      let next = current
      for (let i = 0; i < options.length; i++) {
        next = (next + direction + options.length) % options.length
        if (!options[next]?.disabled) return next
      }
      return current
    })
  }

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    const handleReposition = () => setOpen(false)
    document.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('scroll', handleReposition, true)
    window.addEventListener('resize', handleReposition)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('scroll', handleReposition, true)
      window.removeEventListener('resize', handleReposition)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const optionEl = document.getElementById(`${controlId}-option-${highlightedIndex}`)
    optionEl?.scrollIntoView({ block: 'nearest' })
  }, [open, highlightedIndex, controlId])

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        if (!open) openMenu()
        else stepHighlighted(1)
        break
      case 'ArrowUp':
        event.preventDefault()
        if (!open) openMenu()
        else stepHighlighted(-1)
        break
      case 'Enter':
        if (open) {
          event.preventDefault()
          const option = options[highlightedIndex]
          if (option) selectOption(option)
        }
        break
      case ' ':
        if (!open) {
          event.preventDefault()
          openMenu()
        }
        break
      case 'Escape':
        if (open) {
          event.preventDefault()
          setOpen(false)
        }
        break
      case 'Tab':
        if (open) setOpen(false)
        break
      default:
        break
    }
  }

  const handleBlur = () => {
    setOpen(false)
    onBlur?.()
  }

  return (
    <div className={cn('w-full', className)}>
      {label && (
        <label htmlFor={controlId} className="mb-1.5 block text-xs font-medium text-ink-soft">
          {label}
          {required && <span className="ml-0.5 text-rust">*</span>}
        </label>
      )}

      <button
        ref={triggerRef}
        id={controlId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={open && options[highlightedIndex] ? `${controlId}-option-${highlightedIndex}` : undefined}
        aria-label={ariaLabel ?? label}
        aria-required={required}
        aria-invalid={!!error}
        disabled={disabled}
        onClick={() => (open ? closeMenu() : openMenu())}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className={cn(
          'flex h-9 w-full items-center justify-between gap-2 rounded-sm border bg-surface px-3 text-left text-xs text-ink transition-colors',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error ? 'border-danger' : open ? 'border-rust' : 'border-border hover:border-ink-soft',
        )}
      >
        <span className={cn('truncate', !selectedOption && 'text-ink-muted')}>{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown size={14} className={cn('shrink-0 text-ink-muted transition-transform duration-150', open && 'rotate-180')} />
      </button>

      {error && <p className="mt-1 text-[11px] text-danger">{error}</p>}

      {createPortal(
        <AnimatePresence>
          {open && menuStyle && (
            <motion.ul
              ref={menuRef}
              id={listboxId}
              role="listbox"
              aria-labelledby={label ? controlId : undefined}
              tabIndex={-1}
              initial={{ opacity: 0, y: placement === 'bottom' ? -4 : 4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: placement === 'bottom' ? -4 : 4, scale: 0.98 }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
              style={{
                ...menuStyle,
                transformOrigin: placement === 'bottom' ? 'top' : 'bottom',
                boxShadow: 'var(--shadow-dropdown)',
                maxHeight: MAX_MENU_HEIGHT,
              }}
              className="z-[70] overflow-y-auto rounded-sm border border-border bg-surface py-1"
            >
              {options.map((option, index) => {
                const selected = option.value === value
                const highlighted = index === highlightedIndex
                return (
                  <li
                    key={option.value}
                    id={`${controlId}-option-${index}`}
                    role="option"
                    aria-selected={selected}
                    aria-disabled={option.disabled}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => !option.disabled && setHighlightedIndex(index)}
                    onClick={() => selectOption(option)}
                    className={cn(
                      'flex items-center justify-between gap-2 px-3 py-1.5 text-xs transition-colors duration-100',
                      option.disabled
                        ? 'cursor-not-allowed text-ink-muted'
                        : cn('cursor-pointer', selected ? 'text-rust' : 'text-ink'),
                      highlighted && !selected && !option.disabled && 'bg-bg-soft',
                      selected && 'bg-rust-soft/60',
                    )}
                  >
                    <span className="truncate">{option.label}</span>
                    {selected && <Check size={13} className="shrink-0" />}
                  </li>
                )
              })}
            </motion.ul>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  )
}
