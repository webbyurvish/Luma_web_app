import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function MonthSelector() {
  const [monthIndex, setMonthIndex] = useState(8)
  const [year, setYear] = useState(2026)

  const goTo = (delta: number) => {
    let next = monthIndex + delta
    let nextYear = year
    if (next < 0) {
      next = 11
      nextYear -= 1
    } else if (next > 11) {
      next = 0
      nextYear += 1
    }
    setMonthIndex(next)
    setYear(nextYear)
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
        {MONTHS[monthIndex].slice(0, 3).toUpperCase()} {year}
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
