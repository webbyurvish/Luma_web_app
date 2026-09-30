/**
 * Google Sheets cells aren't typed the way the app expects: a date typed or pasted without a
 * date format comes back as its serial number (46280 = 15 Sep 2026), and a name or note made
 * of digits comes back as a number. These helpers make every row safe at the API boundary.
 */

/** Any cell value as text ('' for empty). Use instead of `value?.trim()`. */
export function str(value: unknown): string {
  return value === null || value === undefined ? '' : String(value)
}

// Sheets' day zero is 30 Dec 1899; serials in this range cover 1954–2119, so a real amount
// or count that happens to sit in a date-named column won't be mistaken for a date.
const MIN_SERIAL = 20000
const MAX_SERIAL = 80000
const DATE_KEY = /(date|timestamp|month)$|At$/i

/** Sheets serial (days since 30 Dec 1899, fraction = time of day) → "yyyy-MM-ddTHH:mm:ss" (sheet-local). */
export function serialToIso(serial: number): string {
  const ms = Math.round((serial - 25569) * 86400 * 1000) // 25569 = days from 1899-12-30 to 1970-01-01
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
}

/** Converts date-named fields that arrived as serial numbers into date strings; leaves everything else. */
export function normalizeSheetRow<T>(row: T): T {
  if (!row || typeof row !== 'object') return row
  let changed: Record<string, unknown> | null = null
  for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
    if (typeof value === 'number' && DATE_KEY.test(key) && value >= MIN_SERIAL && value <= MAX_SERIAL) {
      changed ??= { ...(row as Record<string, unknown>) }
      changed[key] = serialToIso(value)
    }
  }
  return (changed ?? row) as T
}

export function normalizeSheetRows<T>(rows: T[]): T[] {
  return rows.map(normalizeSheetRow)
}
