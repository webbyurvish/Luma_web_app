import { ChevronLeft, ChevronRight } from 'lucide-react'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export interface MonthValue {
  monthIndex: number
  year: number
}

/** Builds the "Sep-2026" key the Google Sheets API uses for its `month` field. */
export function monthValueToKey({ monthIndex, year }: MonthValue): string {
  return `${MONTHS[monthIndex].slice(0, 3)}-${year}`
}

interface MonthSelectorProps {
  value: MonthValue
  onChange: (value: MonthValue) => void
}

export function MonthSelector({ value, onChange }: MonthSelectorProps) {
  const goTo = (delta: number) => {
    let next = value.monthIndex + delta
    let nextYear = value.year
    if (next < 0) {
      next = 11
      nextYear -= 1
    } else if (next > 11) {
      next = 0
      nextYear += 1
    }
    onChange({ monthIndex: next, year: nextYear })
  }

  return (
    <div className="flex items-center gap-0.5 border border-border bg-surface px-1 py-1">
      <button
        onClick={() => goTo(-1)}
        aria-label="Previous month"
        className="flex h-6 w-6 items-center justify-center text-ink-soft transition-colors hover:text-ink"
      >
        <ChevronLeft size={13} />
      </button>
      <span className="min-w-[104px] text-center font-mono-figure text-[11px] text-ink">
        {MONTHS[value.monthIndex].slice(0, 3).toUpperCase()} {value.year}
      </span>
      <button
        onClick={() => goTo(1)}
        aria-label="Next month"
        className="flex h-6 w-6 items-center justify-center text-ink-soft transition-colors hover:text-ink"
      >
        <ChevronRight size={13} />
      </button>
    </div>
  )
}
