import { useSyncExternalStore } from 'react'

/** Which kinds of alerts the bell shows — per device, outside the luma:* data keys. */
export type NotifyKind = 'bill' | 'budget' | 'task' | 'sip' | 'udhaar' | 'document' | 'recharge' | 'date' | 'vehicle' | 'import'

export const NOTIFY_KINDS: { kind: NotifyKind; title: string; detail: string }[] = [
  { kind: 'date', title: 'Birthdays and important dates', detail: 'Before family birthdays, anniversaries and remembrance days' },
  { kind: 'recharge', title: 'Recharges', detail: 'Before a family mobile, DTH or FASTag recharge runs out' },
  { kind: 'vehicle', title: 'Vehicle papers and service', detail: 'Before insurance, PUC or a service is due' },
  { kind: 'import', title: 'Monthly statement import', detail: "Early each month, until last month's Google Pay statement is imported" },
  { kind: 'bill', title: 'Bills due', detail: 'Before each bill is due, and when one is overdue' },
  { kind: 'budget', title: 'Budget limits', detail: 'When a category reaches its warning level or goes over' },
  { kind: 'udhaar', title: 'Udhaar reminders', detail: "When money you're owed is due or late" },
  { kind: 'task', title: 'Task reminders', detail: 'Tasks due today or overdue' },
  { kind: 'sip', title: 'SIP debits', detail: 'Two days before a SIP is debited' },
  { kind: 'document', title: 'Expiring documents', detail: 'Documents expiring within 30 days' },
]

const KEY = 'lumaui:notify-prefs'
const listeners = new Set<() => void>()

function read(): Record<NotifyKind, boolean> {
  const all = Object.fromEntries(NOTIFY_KINDS.map((k) => [k.kind, true])) as Record<NotifyKind, boolean>
  try {
    return { ...all, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Record<NotifyKind, boolean>>) }
  } catch {
    return all
  }
}

let prefs = read()

export function setNotifyPref(kind: NotifyKind, on: boolean) {
  prefs = { ...prefs, [kind]: on }
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs))
  } catch {
    // kept for this page only
  }
  listeners.forEach((l) => l())
}

export function useNotifyPrefs(): Record<NotifyKind, boolean> {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => prefs,
  )
}
