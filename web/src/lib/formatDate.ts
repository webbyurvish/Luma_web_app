const dayFormatter = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' })
const fullFormatter = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
const weekdayFormatter = new Intl.DateTimeFormat('en-IN', { weekday: 'long' })
const monthYearFormatter = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' })

export function formatDate(iso: string): string {
  return dayFormatter.format(new Date(iso))
}

export function formatFullDate(iso: string): string {
  return fullFormatter.format(new Date(iso))
}

export function formatWeekday(iso: string): string {
  return weekdayFormatter.format(new Date(iso))
}

export function formatMonthYear(iso: string): string {
  return monthYearFormatter.format(new Date(iso))
}

const timeFormatter = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true })

/**
 * Formats a timestamp as "8:15 PM". A bare "YYYY-MM-DDTHH:mm:ss" (no zone suffix) is
 * read as already being IST wall-clock time and formatted directly — converting it
 * through Asia/Kolkata again would double-shift it if the machine running the code
 * isn't itself in IST. A string with an explicit zone is converted properly.
 */
export function formatTime(iso: string): string {
  const plainMatch = /T(\d{2}):(\d{2})/.exec(iso)
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(iso)
  if (plainMatch && !hasZone) {
    const hour24 = Number(plainMatch[1])
    const minute = plainMatch[2]
    const period = hour24 >= 12 ? 'PM' : 'AM'
    const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12
    return `${hour12}:${minute} ${period}`
  }

  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return ''
  return timeFormatter.format(parsed).toUpperCase()
}

/**
 * Extracts the Asia/Kolkata calendar day (YYYY-MM-DD) from a timestamp. A bare
 * "YYYY-MM-DDTHH:mm:ss" string with no zone suffix is treated as already being IST
 * wall-clock time (how the Apps Script sheet records it) and read directly — no Date
 * object round-trip, so there is no risk of the machine's local timezone shifting the
 * day. A string with an explicit zone (e.g. trailing "Z") is converted properly.
 */
export function toIstDateKey(iso: string): string {
  const plainMatch = /^(\d{4}-\d{2}-\d{2})/.exec(iso)
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(iso)
  if (plainMatch && !hasZone) return plainMatch[1]

  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso.slice(0, 10)
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(
    parsed,
  )
  const lookup = Object.fromEntries(parts.map((p) => [p.type, p.value]))
  return `${lookup.year}-${lookup.month}-${lookup.day}`
}

/** The current calendar month in Asia/Kolkata, as a zero-indexed month + year. */
export function currentIstMonth(): { monthIndex: number; year: number } {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit' }).formatToParts(new Date())
  const lookup = Object.fromEntries(parts.map((p) => [p.type, p.value]))
  return { monthIndex: Number(lookup.month) - 1, year: Number(lookup.year) }
}

/** Today's calendar date in Asia/Kolkata, as a YYYY-MM-DD key. */
export function todayIstDateKey(): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(
    new Date(),
  )
  const lookup = Object.fromEntries(parts.map((p) => [p.type, p.value]))
  return `${lookup.year}-${lookup.month}-${lookup.day}`
}

export const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Converts a YYYY-MM-DD key into the sheet's "Sep-2026" month label. */
export function dateKeyToMonthLabel(dateKey: string): string {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(dateKey)
  if (!match) return dateKey
  return `${MONTH_ABBR[Number(match[2]) - 1]}-${match[1]}`
}

/**
 * Normalizes a sheet "month" value into a "Sep-2026" label. The Transactions sheet's
 * Month column is a Date cell, so Apps Script serializes it as an ISO timestamp (e.g.
 * "2026-08-31T18:30:00.000Z", which is midnight IST on the 1st shifted to UTC) rather
 * than the plain text the API docs show — this resolves either shape to the same label,
 * falling back to the row's own transaction date if the month value is unusable.
 */
export function normalizeMonthLabel(rawMonth: string | undefined, fallbackTimestamp: string): string {
  const trimmed = rawMonth?.trim()
  if (trimmed && /^[A-Za-z]{3}-\d{4}$/.test(trimmed)) return trimmed
  if (trimmed) {
    const asDateKey = toIstDateKey(trimmed)
    if (/^\d{4}-\d{2}-\d{2}$/.test(asDateKey)) return dateKeyToMonthLabel(asDateKey)
  }
  return dateKeyToMonthLabel(toIstDateKey(fallbackTimestamp))
}

export function formatRelativeDate(iso: string): string {
  const dateKey = toIstDateKey(iso)
  const todayKey = todayIstDateKey()
  const diffDays = Math.round((Date.parse(`${todayKey}T00:00:00Z`) - Date.parse(`${dateKey}T00:00:00Z`)) / 86_400_000)

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`
  return dayFormatter.format(new Date(iso))
}
