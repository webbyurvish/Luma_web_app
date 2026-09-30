import { formatTime, normalizeMonthLabel, toIstDateKey } from './formatDate'
import type { CategoryId, RawTransaction, Transaction, TransactionType } from '@/types'
import { str } from './sheetValues'

const KNOWN_CATEGORIES: Record<string, CategoryId> = {
  food: 'food',
  transport: 'transport',
  transportation: 'transport',
  shopping: 'shopping',
  bills: 'bills',
  bill: 'bills',
  home: 'home',
  entertainment: 'entertainment',
  health: 'health',
  income: 'income',
  udhaar: 'udhaar',
  other: 'other',
}

/** Maps a free-text sheet category to a known icon/color bucket. Unrecognized text safely becomes 'other'. */
function normalizeCategoryId(raw: string): CategoryId {
  return KNOWN_CATEGORIES[str(raw).trim().toLowerCase()] ?? 'other'
}

function normalizeType(raw: string): TransactionType | null {
  const value = str(raw).trim().toLowerCase()
  if (value === 'expense') return 'expense'
  if (value === 'income') return 'income'
  return null
}

/** Builds the row's display line: prefer merchant, then subcategory, then category, else a clear fallback. */
function resolveDescription(row: RawTransaction): string {
  const merchant = str(row.merchant).trim()
  if (merchant) return merchant
  const subcategory = str(row.subcategory).trim()
  if (subcategory) return subcategory
  const category = str(row.category).trim()
  if (category) return category
  return 'Unknown'
}

function normalizeAmount(value: unknown): number | null {
  const amount = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(amount)) return null
  return amount
}

/**
 * Normalizes raw Google Sheets rows into the app's Transaction shape, safely at this one
 * boundary so nothing downstream has to handle nulls, blank strings or malformed amounts.
 * Rows with an unusable amount or an unrecognized type are dropped (never guessed) and
 * reported via onSkip so the caller can log them without crashing the UI.
 */
export function normalizeTransactions(rows: RawTransaction[], onSkip?: (row: RawTransaction, reason: string) => void): Transaction[] {
  const result: Transaction[] = []

  rows.forEach((row, index) => {
    const amount = normalizeAmount(row.amount)
    if (amount === null) {
      onSkip?.(row, 'invalid amount')
      return
    }

    const type = normalizeType(row.type ?? '')
    if (!type) {
      onSkip?.(row, `unrecognized type "${row.type}"`)
      return
    }

    const timestamp = row.timestamp || row.date
    if (!timestamp) {
      onSkip?.(row, 'missing timestamp')
      return
    }

    const category = str(row.category).trim() || 'Other'

    result.push({
      id: `sheet-${toIstDateKey(timestamp)}-${index}-${amount}`,
      category: normalizeCategoryId(category),
      description: resolveDescription(row),
      type,
      date: toIstDateKey(timestamp),
      time: formatTime(timestamp),
      payment: str(row.paymentMethod).trim() || 'Other',
      amount,
      status: 'successful',
      rawCategory: category,
      rawSubcategory: str(row.subcategory).trim() || undefined,
      merchant: str(row.merchant).trim() || undefined,
      note: str(row.note).trim() || undefined,
      month: normalizeMonthLabel(row.month, timestamp),
      sourceId: str(row.id).trim() || undefined,
    })
  })

  return result
}
