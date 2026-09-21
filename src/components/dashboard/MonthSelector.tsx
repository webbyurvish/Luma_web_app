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
    <div className="flex items-center gap-1 rounded-pill border border-border bg-card px-1.5 py-1.5 shadow-xs">
      <button
        onClick={() => goTo(-1)}
        aria-label="Previous month"
        className="flex h-7 w-7 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-bg-soft hover:text-ink"
      >
        <ChevronLeft size={15} />
      </button>
      <span className="min-w-[128px] text-center text-sm font-medium text-ink">
        {MONTHS[monthIndex]} {year}
      </span>
      <button
        onClick={() => goTo(1)}
        aria-label="Next month"
        className="flex h-7 w-7 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-bg-soft hover:text-ink"
      >
        <ChevronRight size={15} />
      </button>
    </div>
  )
}
