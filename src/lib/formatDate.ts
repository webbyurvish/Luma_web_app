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

export function formatRelativeDate(iso: string): string {
  const date = new Date(iso)
  const today = new Date('2026-09-22')
  const diffDays = Math.round((today.setHours(0, 0, 0, 0) - date.setHours(0, 0, 0, 0)) / 86_400_000)

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`
  return dayFormatter.format(new Date(iso))
}
