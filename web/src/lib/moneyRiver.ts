import { billStatus } from '@/lib/planning'
import { getUpcomingSips } from '@/lib/financeCalculations'
import { addDaysIso, dayDiff, nextOccurrence, dateTitle, serviceInText } from '@/lib/family'
import { vehicleDues } from '@/lib/vehicles'
import type { Bill, FinancialAccount, ImportantDate, Recharge, SIP, Transaction, Vehicle } from '@/types'

/**
 * Home's "money river": one timeline from what just happened, through where you stand now,
 * to what's coming in the next weeks. Built only from data the app already loads.
 */

export type RiverTone = 'out' | 'in' | 'remind' | 'late'

export interface RiverEvent {
  id: string
  date: string
  title: string
  detail?: string
  /** Money in (+) or out (−); undefined for reminders. */
  amount?: number
  tone: RiverTone
  to: string
  state?: Record<string, unknown>
}

export interface River {
  past: RiverEvent[]
  /** Overdue things — shown at "Now" because they need you today. */
  late: RiverEvent[]
  upcoming: RiverEvent[]
  balance: number
  accountCount: number
  /** Money going out in the next 7 days (bills + SIPs). */
  outThisWeek: number
}

export interface RiverInput {
  today: string
  transactions: Transaction[]
  accounts: FinancialAccount[]
  bills: Bill[]
  sips: SIP[]
  recharges: Recharge[]
  dates: ImportantDate[]
  vehicles: Vehicle[]
  /** People who owe you, with a due date. */
  receivables: { name: string; outstanding: number; dueDate?: string }[]
  horizonDays?: number
}

const SPENDABLE = new Set(['bank', 'cash', 'wallet'])

/** The latest salary-looking income; expected again a month later. */
function expectedSalary(transactions: Transaction[], today: string): RiverEvent | null {
  const salary = transactions
    .filter((t) => t.type === 'income' && /salary|payroll/i.test(`${t.rawCategory ?? ''} ${t.rawSubcategory ?? ''} ${t.merchant ?? ''}`))
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0]
  if (!salary || dayDiff(salary.date, today) > 45) return null
  const [y, m, d] = salary.date.split('-').map(Number)
  const next = new Date(Date.UTC(y, m, Math.min(d, 28))).toISOString().slice(0, 10)
  if (next <= today) return null
  return { id: `salary:${next}`, date: next, title: 'Salary expected', detail: `${salary.merchant || 'Based on last month'}`, amount: salary.amount, tone: 'in', to: '/transactions' }
}

export function buildRiver(input: RiverInput): River {
  const { today, transactions } = input
  const horizon = addDaysIso(today, input.horizonDays ?? 30)
  const inWindow = (d: string) => d >= today && d <= horizon
  const upcoming: RiverEvent[] = []
  const late: RiverEvent[] = []

  input.bills.forEach((b) => {
    const { state } = billStatus(b, today)
    if (state === 'paused') return
    const ev: RiverEvent = { id: `bill:${b.id}:${b.nextDueDate}`, date: b.nextDueDate, title: b.name, detail: state === 'overdue' ? 'Bill overdue' : 'Bill due', amount: -b.amount, tone: state === 'overdue' ? 'late' : 'out', to: '/finance', state: { tab: 'bills' } }
    if (state === 'overdue') late.push(ev)
    else if (inWindow(b.nextDueDate)) upcoming.push(ev)
  })

  getUpcomingSips(input.sips, today, 50)
    .filter(({ nextDate }) => inWindow(nextDate))
    .forEach(({ sip, nextDate }) => upcoming.push({ id: `sip:${sip.id}:${nextDate}`, date: nextDate, title: sip.fundName || sip.name, detail: 'SIP debit', amount: -sip.amount, tone: 'out', to: '/finance', state: { tab: 'sips' } }))

  input.recharges.forEach((r) => {
    if (!r.isActive || !r.expiresOn) return
    const ev: RiverEvent = { id: `rch:${r.id}:${r.expiresOn}`, date: r.expiresOn, title: `${r.person}'s ${serviceInText(r.service)} runs out`, detail: [r.provider, r.number].filter(Boolean).join(' · ') || undefined, amount: r.amount ? -r.amount : undefined, tone: r.expiresOn < today ? 'late' : 'remind', to: '/family', state: { tab: 'recharges' } }
    if (r.expiresOn < today) late.push(ev)
    else if (inWindow(r.expiresOn)) upcoming.push(ev)
  })

  input.dates.forEach((d) => {
    const next = nextOccurrence(d, today)
    if (!inWindow(next.date)) return
    upcoming.push({ id: `date:${d.id}:${next.date}`, date: next.date, title: dateTitle(d), detail: d.occasion, tone: 'remind', to: '/family', state: { tab: 'dates' } })
  })

  input.vehicles.forEach((v) => {
    if (!v.isActive) return
    vehicleDues(v, today, null).forEach((due) => {
      if (!due.date) return
      const what = due.key === 'puc' ? 'PUC' : due.key === 'service' ? 'service' : 'insurance'
      const ev: RiverEvent = { id: `veh:${v.id}:${due.key}:${due.date}`, date: due.date, title: `${v.name} ${what}`, detail: due.key === 'service' ? 'Service due' : 'Renewal due', tone: due.date < today ? 'late' : 'remind', to: '/vehicles' }
      if (due.date < today) late.push(ev)
      else if (inWindow(due.date)) upcoming.push(ev)
    })
  })

  input.receivables.forEach((p) => {
    if (p.outstanding <= 0 || !p.dueDate) return
    const ev: RiverEvent = { id: `udh:${p.name}:${p.dueDate}`, date: p.dueDate, title: `${p.name} to pay you back`, detail: 'Udhaar', amount: p.outstanding, tone: p.dueDate < today ? 'late' : 'in', to: '/udhaar' }
    if (p.dueDate < today) late.push(ev)
    else if (inWindow(p.dueDate)) upcoming.push(ev)
  })

  const salary = expectedSalary(transactions, today)
  if (salary && inWindow(salary.date)) upcoming.push(salary)

  // The last few days, newest first, nearest "Now".
  const past = transactions
    .filter((t) => t.type !== 'transfer' && t.date <= today && t.date >= addDaysIso(today, -7))
    .sort((a, b) => (a.date === b.date ? (a.time < b.time ? 1 : -1) : a.date < b.date ? 1 : -1))
    .slice(0, 4)
    .map<RiverEvent>((t) => ({
      id: `txn:${t.id}`,
      date: t.date,
      title: t.description,
      detail: [t.rawCategory, t.time].filter(Boolean).join(' · ') || undefined,
      amount: t.type === 'income' ? t.amount : -t.amount,
      tone: t.type === 'income' ? 'in' : 'out',
      to: '/transactions',
      state: { search: t.description },
    }))

  const spendable = input.accounts.filter((a) => a.isActive && SPENDABLE.has(a.type))
  const weekEnd = addDaysIso(today, 6)
  upcoming.sort((a, b) => (a.date === b.date ? (a.amount ?? 0) - (b.amount ?? 0) : a.date < b.date ? -1 : 1))
  late.sort((a, b) => (a.date < b.date ? -1 : 1))

  return {
    past,
    late,
    upcoming,
    balance: spendable.reduce((s, a) => s + a.balance, 0),
    accountCount: spendable.length,
    outThisWeek: upcoming.filter((e) => e.date <= weekEnd && (e.amount ?? 0) < 0).reduce((s, e) => s - (e.amount ?? 0), 0),
  }
}

/** "Today", "Tomorrow", "Yesterday", "Fri, 10 Oct". */
export function riverDayLabel(date: string, today: string): string {
  const diff = dayDiff(today, date)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}
