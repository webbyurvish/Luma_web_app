import { PdfPasswordError, openPdf } from './pdfjs'

/**
 * Reads a Google Pay (India) statement PDF on the device — the file never leaves the phone.
 *
 * A statement lists each payment as:
 *   01 Aug, 2026   Paid to Swiggy                          ₹450.00
 *   1:12 PM        UPI Transaction ID: 427112345678
 *                  Paid by HDFC Bank 4321
 * (credits read "Received from …" and "Paid to <your bank> 1234").
 * We rebuild text rows from positions, then walk them with a small state machine.
 */

export type GpayDirection = 'debit' | 'credit' | 'self'

export interface GpayRow {
  key: string
  date: string // yyyy-MM-dd
  time: string // "1:12 PM" or ''
  direction: GpayDirection
  payee: string
  reference: string // UPI transaction ID
  bankName: string
  last4: string
  amount: number
}

export interface GpayStatement {
  rows: GpayRow[]
  from: string
  to: string
  /** Text rows we couldn't use (for troubleshooting an unexpected layout). */
  unparsed: number
  lines: string[]
}

export { PdfPasswordError }

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 }

function toIso(day: string, month: string, year: string): string | null {
  const m = MONTHS[month.toLowerCase().slice(0, month.toLowerCase().startsWith('sept') ? 4 : 3)]
  if (!m) return null
  return `${year}-${String(m).padStart(2, '0')}-${String(Number(day)).padStart(2, '0')}`
}

/** Text rows of every page, top to bottom, left to right. */
export async function extractPdfLines(file: File, password?: string): Promise<string[]> {
  let opened
  try {
    opened = await openPdf(await file.arrayBuffer(), password)
  } catch (err) {
    if (err instanceof PdfPasswordError) throw err
    throw new Error("This doesn't look like a readable PDF. Download the statement again from Google Pay.")
  }
  const { doc, close } = opened
  const lines: string[] = []
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const content = await page.getTextContent()
    const rows: { y: number; items: { x: number; s: string }[] }[] = []
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue
      const x = item.transform[4]
      const y = item.transform[5]
      const row = rows.find((r) => Math.abs(r.y - y) < 3)
      if (row) row.items.push({ x, s: item.str })
      else rows.push({ y, items: [{ x, s: item.str }] })
    }
    rows
      .sort((a, b) => b.y - a.y)
      .forEach((r) => lines.push(r.items.sort((a, b) => a.x - b.x).map((i) => i.s.trim()).join(' ').replace(/\s+/g, ' ').trim()))
  }
  await close()
  return lines
}

const DATE_RE = /\b(\d{1,2})\s+([A-Za-z]{3,9}),?\s+(\d{4})\b/
const TIME_RE = /\b(\d{1,2}:\d{2}\s*[AaPp][Mm])\b/
const AMOUNT_RE = /(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/
const UPI_RE = /UPI\s+Transaction\s+ID\s*:?\s*([A-Za-z0-9]+)/i
const DIRECTION_RE = /\b(Paid\s+to|Received\s+from|Self\s+transfer\s+to|Top-?up\s+to|Transferred\s+to|Sent\s+to)\s+(.*)$/i
const ACCOUNT_RE = /\bPaid\s+(?:by|to)\s+(.+?)\s*(?:[Xx*•.]+\s*)?(\d{4})\s*$/i
const NOISE_RE = /^(page\s+\d+|transaction statement|statement period|date\s*&\s*time|transaction details|amount$|note[:\s]|this is a system|google pay|sent\b|received\b(?!\s+from)|for any queries|https?:)/i

export function parseGpayLines(lines: string[]): GpayStatement {
  const rows: GpayRow[] = []
  let cur: Partial<GpayRow> & { dirSet?: boolean } = {}
  let unparsed = 0

  const flush = () => {
    if (cur.date && cur.dirSet && cur.amount && cur.amount > 0) {
      rows.push({
        key: cur.reference || `${cur.date}-${cur.time}-${cur.amount}-${rows.length}`,
        date: cur.date,
        time: cur.time ?? '',
        direction: cur.direction ?? 'debit',
        payee: (cur.payee ?? '').replace(/\s+/g, ' ').trim() || 'Unknown',
        reference: cur.reference ?? '',
        bankName: cur.bankName ?? '',
        last4: cur.last4 ?? '',
        amount: cur.amount,
      })
    }
    cur = {}
  }

  for (const raw of lines) {
    let line = raw
    let used = false

    const date = DATE_RE.exec(line)
    if (date) {
      const iso = toIso(date[1], date[2], date[3])
      if (iso) {
        flush()
        cur.date = iso
        line = line.replace(date[0], ' ')
        used = true
      }
    }
    if (!cur.date) continue // header area before the first payment

    const amount = AMOUNT_RE.exec(line)
    if (amount && cur.amount === undefined) {
      cur.amount = Number(amount[1].replace(/,/g, ''))
      line = line.replace(amount[0], ' ')
      used = true
    }
    const time = TIME_RE.exec(line)
    if (time && !cur.time) {
      cur.time = time[1].toUpperCase().replace(/\s*(AM|PM)/, ' $1')
      line = line.replace(time[0], ' ')
      used = true
    }
    const upi = UPI_RE.exec(line)
    if (upi) {
      cur.reference = upi[1]
      line = line.replace(upi[0], ' ')
      used = true
    }
    line = line.replace(/\s+/g, ' ').trim()

    // After the transaction ID (or once a direction is known), "Paid by/to …1234" is the bank line.
    const account = ACCOUNT_RE.exec(line)
    if (account && cur.dirSet && (cur.reference || /\bbank\b/i.test(account[1]))) {
      // "UPI Lite | ICICI Bank 0381": spent from the Lite wallet, which the ICICI account tops up.
      cur.bankName = account[1].replace(/^UPI\s+Lite\s*\|\s*/i, '').replace(/\s+/g, ' ').trim()
      cur.last4 = account[2]
      used = true
      continue
    }
    const direction = DIRECTION_RE.exec(line)
    if (direction && !cur.dirSet) {
      const word = direction[1].toLowerCase()
      cur.direction = word.startsWith('received') ? 'credit' : word.startsWith('self') || word.startsWith('top') ? 'self' : 'debit'
      cur.payee = direction[2]
      cur.dirSet = true
      used = true
      continue
    }
    // A long payee name wraps onto the next row (before the transaction ID appears).
    if (line && cur.dirSet && !cur.reference && !NOISE_RE.test(line) && line.length < 60) {
      cur.payee = `${cur.payee ?? ''} ${line}`
      used = true
    }
    if (!used && line && !NOISE_RE.test(line)) unparsed++
  }
  flush()

  const dates = rows.map((r) => r.date).sort()
  return { rows, from: dates[0] ?? '', to: dates[dates.length - 1] ?? '', unparsed, lines }
}

export async function readGpayStatement(file: File, password?: string): Promise<GpayStatement> {
  return parseGpayLines(await extractPdfLines(file, password))
}
