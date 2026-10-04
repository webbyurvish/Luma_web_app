import { useCallback, useMemo, useState, useSyncExternalStore } from 'react'
import { getSnapshot, subscribe } from '@/lib/remoteStore'
import { billStatus, budgetUsage, dueLabel } from '@/lib/planning'
import { getUpcomingSips } from '@/lib/financeCalculations'
import { formatCurrency } from '@/lib/formatCurrency'
import { formatDate, todayIstDateKey } from '@/lib/formatDate'
import { useBills, useBudgets } from './usePlanning'
import { useTasks, useUdhaar } from './useLifeCollections'
import { useSips } from './useFinanceCollections'
import { useTransactions } from './useTransactions'
import type { DriveTree } from '@/types'
import { useNotifyPrefs } from '@/lib/notifyPrefs'
import { useImportantDates, useRecharges } from './useFamily'
import { useVehicles } from './useLife'
import { dueText, vehicleDues } from '@/lib/vehicles'
import { monthName, shiftMonth } from '@/lib/monthReview'
import { countLabel, dateTitle, expiryLabel, nextOccurrence, rechargeStatus, serviceInText } from '@/lib/family'

export type NotificationTone = 'danger' | 'warn' | 'info'

export interface AppNotification {
  /** Stable per occurrence (e.g. bill + due date), so a dismissal doesn't hide next month's. */
  id: string
  tone: NotificationTone
  kind: 'bill' | 'budget' | 'task' | 'sip' | 'udhaar' | 'document' | 'recharge' | 'date' | 'vehicle' | 'import'
  title: string
  detail: string
  /** Where tapping it goes. */
  to: string
  state?: Record<string, unknown>
}

/* Dismissals are per device and hold nothing but ids, so they live outside the luma:* data
 * keys (which are wiped at sign-out) and survive the 2-hour session. */
const DISMISSED_KEY = 'lumaui:dismissed-notifications'

function readDismissed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

function writeDismissed(ids: Set<string>) {
  try {
    // Keep the newest few hundred; old occurrences can never come back anyway.
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids].slice(-400)))
  } catch {
    // Storage blocked: dismissals last for this page only.
  }
}

const TONE_ORDER: Record<NotificationTone, number> = { danger: 0, warn: 1, info: 2 }

function addDays(iso: string, n: number): string {
  const d = new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)) + n))
  return d.toISOString().slice(0, 10)
}

/** Everything in Luma that needs attention now — computed from data the app already loads. */
export function useNotifications() {
  const today = todayIstDateKey()
  const month = today.slice(0, 7)
  const { bills } = useBills()
  const { budgets } = useBudgets()
  const { tasks } = useTasks()
  const { sips } = useSips()
  const { people } = useUdhaar()
  const { transactions } = useTransactions()
  const { recharges } = useRecharges()
  const { dates } = useImportantDates()
  const { vehicles } = useVehicles()
  // Documents only count once the (heavy) Drive listing has been loaded by the Documents page.
  const drive = useSyncExternalStore(
    (l) => subscribe('drive', l),
    () => getSnapshot('drive'),
  )
  const [dismissed, setDismissed] = useState(readDismissed)
  const prefs = useNotifyPrefs()

  const all = useMemo<AppNotification[]>(() => {
    const out: AppNotification[] = []

    bills.forEach((bill) => {
      const { state, days } = billStatus(bill, today)
      if (state !== 'overdue' && state !== 'today' && state !== 'soon') return
      out.push({
        id: `bill:${bill.id}:${bill.nextDueDate}`,
        tone: state === 'overdue' ? 'danger' : 'warn',
        kind: 'bill',
        title: `${bill.name} · ${formatCurrency(bill.amount)}`,
        detail: `${dueLabel(days)} (${formatDate(bill.nextDueDate)})`,
        to: '/finance',
        state: { tab: 'bills' },
      })
    })

    budgetUsage(budgets, transactions, month).forEach((u) => {
      if (u.state === 'ok') return
      out.push({
        id: `budget:${u.budget.id}:${month}:${u.state}`,
        tone: u.state === 'over' ? 'danger' : 'warn',
        kind: 'budget',
        title: u.state === 'over' ? `${u.budget.category} budget exceeded` : `${u.budget.category} budget at ${Math.round(u.ratio * 100)}%`,
        detail: `${formatCurrency(u.spent)} of ${formatCurrency(u.budget.monthlyLimit)} this month`,
        to: '/finance',
        state: { tab: 'budgets' },
      })
    })

    tasks.forEach((task) => {
      if (task.completed || task.status === 'Completed' || task.status === 'Cancelled' || !task.dueDate || task.dueDate > today) return
      out.push({
        id: `task:${task.id}:${task.dueDate}`,
        tone: task.dueDate < today ? 'danger' : 'warn',
        kind: 'task',
        title: task.title,
        detail: task.dueDate < today ? `Task overdue since ${formatDate(task.dueDate)}` : 'Task due today',
        to: '/tasks',
      })
    })

    getUpcomingSips(sips, today, 10)
      .filter(({ nextDate }) => nextDate <= addDays(today, 2))
      .forEach(({ sip, nextDate }) => {
        out.push({
          id: `sip:${sip.id}:${nextDate}`,
          tone: 'info',
          kind: 'sip',
          title: `SIP · ${sip.fundName}`,
          detail: `${formatCurrency(sip.amount)} ${nextDate === today ? 'debits today' : `on ${formatDate(nextDate)}`} — keep the balance ready`,
          to: '/finance',
          state: { tab: 'sips' },
        })
      })

    people.forEach((p) => {
      if (p.outstanding <= 0 || !p.dueDate || p.dueDate > addDays(today, 3)) return
      out.push({
        id: `udhaar:${p.name}:${p.dueDate}`,
        tone: p.dueDate < today ? 'danger' : 'info',
        kind: 'udhaar',
        title: `${p.name} owes ${formatCurrency(p.outstanding)}`,
        detail: p.dueDate < today ? `Was due ${formatDate(p.dueDate)}` : `Due ${formatDate(p.dueDate)}`,
        to: '/udhaar',
      })
    })

    recharges.forEach((r) => {
      const { state, days } = rechargeStatus(r, today)
      if (state !== 'expired' && state !== 'today' && state !== 'soon') return
      out.push({
        id: `recharge:${r.id}:${r.expiresOn}`,
        tone: state === 'soon' ? 'warn' : 'danger',
        kind: 'recharge',
        title: `${r.person}'s ${serviceInText(r.service)}${r.provider ? ' · ' + r.provider : ''}`,
        detail: `${expiryLabel(days)}${r.number ? ' · ' + r.number : ''}`,
        to: '/family',
        state: { tab: 'recharges' },
      })
    })

    dates.forEach((d) => {
      const next = nextOccurrence(d, today)
      if (next.days > d.remindDaysBefore) return
      const extra = countLabel(d, next.count)
      out.push({
        id: `date:${d.id}:${next.date}`,
        tone: next.days === 0 ? 'warn' : 'info',
        kind: 'date',
        title: dateTitle(d),
        detail: (next.days === 0 ? 'Today' : next.days === 1 ? 'Tomorrow' : `In ${next.days} days · ${formatDate(next.date)}`) + (extra ? ` · ${extra}` : ''),
        to: '/family',
        state: { tab: 'dates' },
      })
    })

    vehicles.forEach((v) => {
      if (!v.isActive) return
      vehicleDues(v, today, null).forEach((d) => {
        if (d.state !== 'overdue' && d.state !== 'today' && d.state !== 'soon') return
        out.push({
          id: `vehicle:${v.id}:${d.key}:${d.date}`,
          tone: d.state === 'soon' ? 'warn' : 'danger',
          kind: 'vehicle',
          title: `${v.name} · ${d.key === 'puc' ? 'PUC' : d.key === 'service' ? 'service' : 'insurance'}`,
          detail: `${d.key === 'service' ? 'Service due' : 'Expires'} ${dueText(d).toLowerCase()} (${formatDate(d.date)})`,
          to: '/vehicles',
        })
      })
    })

    // Early in the month: last month's Google Pay statement, until a statement row from it exists.
    const previous = shiftMonth(month, -1)
    if (Number(today.slice(8, 10)) <= 10 && transactions.length && !transactions.some((t) => t.reference && t.date.slice(0, 7) === previous)) {
      out.push({
        id: `import:${previous}`,
        tone: 'info',
        kind: 'import',
        title: `Import ${monthName(previous, false)}'s Google Pay statement`,
        detail: 'Download it in Google Pay — Luma adds every payment and fills in categories it knows',
        to: '/transactions',
        state: { tab: 'import-gpay' },
      })
    }

    const tree = (drive.raw as DriveTree[] | null)?.[0]
    tree?.files.forEach((file) => {
      if (!file.expiryDate || file.expiryDate > addDays(today, 30)) return
      out.push({
        id: `doc:${file.id}:${file.expiryDate}`,
        tone: file.expiryDate < today ? 'danger' : 'warn',
        kind: 'document',
        title: file.name,
        detail: file.expiryDate < today ? `Expired ${formatDate(file.expiryDate)} — renew it` : `Expires ${formatDate(file.expiryDate)}`,
        to: '/documents',
      })
    })

    return out.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone])
  }, [bills, budgets, tasks, sips, people, transactions, recharges, dates, vehicles, drive, today, month])

  const visible = useMemo(() => all.filter((n) => prefs[n.kind] && !dismissed.has(n.id)), [all, dismissed, prefs])

  const dismiss = useCallback((id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev).add(id)
      writeDismissed(next)
      return next
    })
  }, [])

  const dismissAll = useCallback(() => {
    setDismissed((prev) => {
      const next = new Set([...prev, ...visible.map((n) => n.id)])
      writeDismissed(next)
      return next
    })
  }, [visible])

  return { notifications: visible, urgent: visible.filter((n) => n.tone !== 'info').length, dismiss, dismissAll }
}
