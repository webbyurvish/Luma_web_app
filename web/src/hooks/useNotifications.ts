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

export type NotificationTone = 'danger' | 'warn' | 'info'

export interface AppNotification {
  /** Stable per occurrence (e.g. bill + due date), so a dismissal doesn't hide next month's. */
  id: string
  tone: NotificationTone
  kind: 'bill' | 'budget' | 'task' | 'sip' | 'udhaar' | 'document'
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
  // Documents only count once the (heavy) Drive listing has been loaded by the Documents page.
  const drive = useSyncExternalStore(
    (l) => subscribe('drive', l),
    () => getSnapshot('drive'),
  )
  const [dismissed, setDismissed] = useState(readDismissed)

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
  }, [bills, budgets, tasks, sips, people, transactions, drive, today, month])

  const visible = useMemo(() => all.filter((n) => !dismissed.has(n.id)), [all, dismissed])

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
