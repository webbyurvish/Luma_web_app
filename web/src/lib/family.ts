import { Car, Flame, Gift, Heart, HeartHandshake, Smartphone, Sparkles, TrainFront, Tv, Wifi, Zap, type LucideIcon } from 'lucide-react'
import { str } from '@/lib/sheetValues'
import type {
  ImportantDate,
  ImportantDateInput,
  Occasion,
  RawImportantDate,
  RawRecharge,
  RawRechargeLog,
  Recharge,
  RechargeInput,
  RechargeLog,
} from '@/types'

/* ------------------------------------------------------------ recharges */

export interface ServiceMeta {
  icon: LucideIcon
  providers: string[]
  numberLabel: string
  validityChips: number[]
}

export const SERVICES: Record<string, ServiceMeta> = {
  Mobile: { icon: Smartphone, providers: ['Jio', 'Airtel', 'Vi', 'BSNL'], numberLabel: 'Mobile number', validityChips: [28, 56, 84, 365] },
  DTH: { icon: Tv, providers: ['Tata Play', 'Airtel Digital TV', 'Dish TV', 'Sun Direct', 'd2h'], numberLabel: 'Subscriber / VC number', validityChips: [30, 90, 180, 365] },
  FASTag: { icon: Car, providers: ['Paytm', 'ICICI', 'HDFC', 'SBI', 'Axis', 'Airtel Payments', 'Kotak'], numberLabel: 'Vehicle number', validityChips: [30, 90, 365] },
  Broadband: { icon: Wifi, providers: ['JioFiber', 'Airtel Xstream', 'ACT', 'BSNL', 'Hathway', 'Excitel'], numberLabel: 'Account / customer ID', validityChips: [30, 90, 180, 365] },
  Electricity: { icon: Zap, providers: [], numberLabel: 'Consumer / meter number', validityChips: [30] },
  Gas: { icon: Flame, providers: ['Indane', 'HP Gas', 'Bharat Gas', 'Adani Total Gas', 'IGL', 'MGL'], numberLabel: 'Consumer number', validityChips: [30, 45, 60] },
  'Metro card': { icon: TrainFront, providers: [], numberLabel: 'Card number', validityChips: [30, 90] },
  Other: { icon: Sparkles, providers: [], numberLabel: 'Number / ID', validityChips: [30, 90, 365] },
}

export const SERVICE_NAMES = Object.keys(SERVICES)
export const serviceMeta = (service: string): ServiceMeta => SERVICES[service] ?? SERVICES.Other

function bool(value: unknown, fallback = true): boolean {
  if (typeof value === 'boolean') return value
  const s = str(value).trim().toLowerCase()
  if (s === 'false' || s === 'no') return false
  if (s === 'true' || s === 'yes') return true
  return fallback
}

export function normalizeRecharge(raw: RawRecharge): Recharge {
  return {
    id: str(raw.rechargeId),
    person: str(raw.person),
    service: str(raw.service) || 'Mobile',
    provider: str(raw.provider),
    number: str(raw.number),
    plan: str(raw.plan),
    amount: Number(raw.amount) || 0,
    validityDays: Number(raw.validityDays) || 28,
    lastRechargedOn: str(raw.lastRechargedOn).slice(0, 10) || undefined,
    expiresOn: str(raw.expiresOn).slice(0, 10),
    remindDaysBefore: raw.remindDaysBefore === null || raw.remindDaysBefore === undefined ? 3 : Number(raw.remindDaysBefore) || 0,
    isActive: bool(raw.isActive),
    notes: str(raw.notes) || undefined,
  }
}

export function normalizeRechargeLog(raw: RawRechargeLog): RechargeLog {
  return {
    id: str(raw.logId),
    rechargeId: str(raw.rechargeId),
    person: str(raw.person),
    service: str(raw.service),
    provider: str(raw.provider),
    number: str(raw.number),
    rechargedOn: str(raw.rechargedOn).slice(0, 10),
    amount: Number(raw.amount) || 0,
    plan: str(raw.plan),
    validityDays: Number(raw.validityDays) || 0,
    validUntil: str(raw.validUntil).slice(0, 10),
    paidVia: str(raw.paidVia),
    expenseRecorded: bool(raw.expenseRecorded, false),
  }
}

export const buildRechargePayload = (input: Partial<RechargeInput>): Record<string, unknown> => ({ ...input })

export function dayDiff(fromIso: string, toIso: string): number {
  const [a, b] = [fromIso, toIso].map((d) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10))))
  return Math.round((b - a) / 86_400_000)
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)) + days))
  return d.toISOString().slice(0, 10)
}

export type RechargeState = 'expired' | 'today' | 'soon' | 'ok' | 'paused'

export function rechargeStatus(r: Recharge, today: string): { state: RechargeState; days: number } {
  if (!r.isActive || !r.expiresOn) return { state: 'paused', days: 0 }
  const days = dayDiff(today, r.expiresOn)
  if (days < 0) return { state: 'expired', days }
  if (days === 0) return { state: 'today', days }
  if (days <= r.remindDaysBefore) return { state: 'soon', days }
  return { state: 'ok', days }
}

export function expiryLabel(days: number): string {
  if (days < -1) return `Expired ${-days} days ago`
  if (days === -1) return 'Expired yesterday'
  if (days === 0) return 'Expires today'
  if (days === 1) return 'Expires tomorrow'
  return `${days} days left`
}

/** Where the expiry lands after a recharge — queued after a still-running plan, like Jio/Airtel. */
export function nextExpiry(currentExpiry: string, rechargeDate: string, validityDays: number): string {
  const start = currentExpiry && currentExpiry > rechargeDate ? currentExpiry : rechargeDate
  return addDaysIso(start, validityDays)
}

/** Monthly spend across active recharges. */
export function monthlyRechargeSpend(list: Recharge[]): number {
  return list.filter((r) => r.isActive && r.validityDays > 0).reduce((sum, r) => sum + (r.amount * 30) / r.validityDays, 0)
}

/* ------------------------------------------------------- important dates */

export const OCCASIONS: Record<Occasion, { icon: LucideIcon; label: string; wish: (name: string, n: number | null) => string }> = {
  Birthday: {
    icon: Gift,
    label: 'Birthday',
    wish: (name) => `Happy birthday, ${name}! 🎉 Wishing you a wonderful year ahead.`,
  },
  Anniversary: {
    icon: Heart,
    label: 'Anniversary',
    wish: (name, n) => `Happy ${n ? ordinal(n) + ' ' : ''}anniversary, ${name}! 💐 Wishing you both many more happy years.`,
  },
  'Death Anniversary': { icon: HeartHandshake, label: 'Death anniversary', wish: () => '' },
  Other: { icon: Sparkles, label: 'Other', wish: () => '' },
}
export const OCCASION_NAMES = Object.keys(OCCASIONS) as Occasion[]

export function normalizeImportantDate(raw: RawImportantDate): ImportantDate {
  const occasion = (OCCASION_NAMES as string[]).includes(str(raw.occasion)) ? (str(raw.occasion) as Occasion) : 'Other'
  return {
    id: str(raw.dateId),
    person: str(raw.person),
    occasion,
    title: str(raw.title),
    date: str(raw.date).slice(0, 10),
    yearKnown: bool(raw.yearKnown),
    remindDaysBefore: raw.remindDaysBefore === null || raw.remindDaysBefore === undefined ? 7 : Number(raw.remindDaysBefore) || 0,
    notes: str(raw.notes) || undefined,
  }
}

export const buildImportantDatePayload = (input: Partial<ImportantDateInput>): Record<string, unknown> => ({ ...input })

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

function isLeap(y: number) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
}

/** The next time this date comes round (today counts), with days to go and the count it reaches. */
export function nextOccurrence(d: ImportantDate, today: string): { date: string; days: number; count: number | null } {
  const year = Number(today.slice(0, 4))
  const md = d.date.slice(5)
  const at = (y: number) => (md === '02-29' && !isLeap(y) ? `${y}-02-28` : `${y}-${md}`)
  let next = at(year)
  if (next < today) next = at(year + 1)
  const born = Number(d.date.slice(0, 4))
  const count = d.yearKnown && born > 1900 ? Number(next.slice(0, 4)) - born : null
  return { date: next, days: dayDiff(today, next), count }
}

/** "turns 61", "35th anniversary", "3rd year" … */
export function countLabel(d: ImportantDate, count: number | null): string {
  if (count === null || count < 0) return ''
  if (d.occasion === 'Birthday') return count === 0 ? 'born this day' : `turns ${count}`
  if (d.occasion === 'Anniversary') return `${ordinal(count)} anniversary`
  if (d.occasion === 'Death Anniversary') return `${ordinal(count)} year`
  return `${ordinal(count)} year`
}

export function dateTitle(d: ImportantDate): string {
  if (d.title) return d.title
  if (d.occasion === 'Other') return d.person
  return `${d.person}'s ${OCCASIONS[d.occasion].label.toLowerCase()}`
}

/** Service name inside a sentence: "mobile", "broadband" — but DTH and FASTag keep their caps. */
export function serviceInText(service: string): string {
  return /^[A-Z]{2,}|[a-z][A-Z]/.test(service) ? service : service.toLowerCase()
}
