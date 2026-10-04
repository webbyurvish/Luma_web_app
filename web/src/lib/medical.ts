import { str } from '@/lib/sheetValues'
import type { ClaimStatus, MedicalBill, MedicalBillInput, MedicalKind, RawMedicalBill, Transaction } from '@/types'

export const MEDICAL_KINDS: MedicalKind[] = ['Doctor', 'Hospital', 'Lab test', 'Medicines', 'Health check-up', 'Insurance premium', 'Dental', 'Eye', 'Other']
export const CLAIM_STATUSES: ClaimStatus[] = ['Not claimed', 'Claim filed', 'Reimbursed', 'Partly reimbursed', 'Rejected', 'Not claimable']

export const CLAIM_TONE: Record<ClaimStatus, string> = {
  'Not claimed': 'bg-bg-soft text-ink-soft',
  'Claim filed': 'bg-warning-soft text-ink',
  Reimbursed: 'bg-success-soft text-success',
  'Partly reimbursed': 'bg-success-soft text-success',
  Rejected: 'bg-danger-soft text-danger',
  'Not claimable': 'bg-bg-soft text-ink-muted',
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || str(v).trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function normalizeMedicalBill(raw: RawMedicalBill): MedicalBill {
  const kind = str(raw.kind) as MedicalKind
  const status = str(raw.claimStatus) as ClaimStatus
  return {
    id: str(raw.billId),
    person: str(raw.person) || 'Me',
    date: str(raw.date).slice(0, 10),
    kind: MEDICAL_KINDS.includes(kind) ? kind : 'Other',
    provider: str(raw.provider),
    amount: num(raw.amount) ?? 0,
    transactionId: str(raw.transactionId),
    claimStatus: CLAIM_STATUSES.includes(status) ? status : 'Not claimed',
    insurer: str(raw.insurer),
    claimNumber: str(raw.claimNumber),
    claimedAmount: num(raw.claimedAmount),
    reimbursedAmount: num(raw.reimbursedAmount),
    driveFileId: str(raw.driveFileId),
    fileUrl: str(raw.fileUrl),
    notes: str(raw.notes),
  }
}

export const buildMedicalPayload = (input: Partial<MedicalBillInput>): Record<string, unknown> => ({
  ...input,
  ...('claimedAmount' in input ? { claimedAmount: input.claimedAmount ?? '' } : {}),
  ...('reimbursedAmount' in input ? { reimbursedAmount: input.reimbursedAmount ?? '' } : {}),
})

/** Indian financial year (April–March) a date falls in: "2026-27". */
export function fyOf(iso: string): string {
  const y = Number(iso.slice(0, 4))
  const start = Number(iso.slice(5, 7)) >= 4 ? y : y - 1
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`
}

export function fyRange(fy: string): { from: string; to: string } {
  const start = Number(fy.slice(0, 4))
  return { from: `${start}-04-01`, to: `${start + 1}-03-31` }
}

/** What's still out with the insurer: filed claims not yet paid. */
export function pendingClaims(bills: MedicalBill[]): { count: number; amount: number } {
  const pending = bills.filter((b) => b.claimStatus === 'Claim filed')
  return { count: pending.length, amount: pending.reduce((s, b) => s + (b.claimedAmount ?? b.amount), 0) }
}

/** Money spent net of what insurance paid back. */
export function outOfPocket(b: MedicalBill): number {
  return Math.max(0, b.amount - (b.reimbursedAmount ?? 0))
}

export function kindForPayee(name: string): MedicalKind {
  const s = name.toLowerCase()
  if (/pharm|medic|chemist|drug|1mg|netmeds|apollo pharmacy/.test(s)) return 'Medicines'
  if (/\blabs?\b|diagnost|patholog|scan|imaging|x-?ray/.test(s)) return 'Lab test'
  if (/hospital|nursing home|medical cent|icu/.test(s)) return 'Hospital'
  if (/dental|dentist/.test(s)) return 'Dental'
  if (/eye|optic|vision|lens/.test(s)) return 'Eye'
  if (/insurance|star health|niva|care health|hdfc ergo|icici lombard|policybazaar/.test(s)) return 'Insurance premium'
  if (/clinic|\bdr\b|doctor|practo/.test(s)) return 'Doctor'
  return 'Other'
}

const HEALTH = /health|medical|medicine|hospital|doctor|pharm/i

/** Health payments in Luma not yet tied to a bill. */
export function unsortedHealthPayments(transactions: Transaction[], bills: MedicalBill[], since: string): Transaction[] {
  const linked = new Set(bills.map((b) => b.transactionId).filter(Boolean))
  // Bills saved with "also add to my transactions" aren't linked by id; same day + amount means done.
  const typedIn = new Set(bills.filter((b) => !b.transactionId && b.amount > 0).map((b) => `${b.date}|${b.amount}`))
  return transactions
    .filter((t) => t.type === 'expense' && t.date >= since && t.sourceId && !linked.has(t.sourceId) && !typedIn.has(`${t.date}|${t.amount}`))
    .filter((t) => t.category === 'health' || HEALTH.test(t.rawCategory ?? '') || HEALTH.test(t.rawSubcategory ?? ''))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
}
