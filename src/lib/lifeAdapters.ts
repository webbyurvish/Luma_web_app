import { todayIstDateKey, toIstDateKey } from './formatDate'
import {
  DOCUMENT_CATEGORIES,
  type AppDocument,
  type DocumentCategory,
  type DocumentInput,
  type RawDocument,
  type RawTask,
  type RawUdhaar,
  type Task,
  type TaskInput,
  type TaskPriority,
  type TaskStatus,
  type UdhaarEntry,
  type UdhaarEntryInput,
  type UdhaarPerson,
  type UdhaarStatus,
  type UdhaarSummary,
} from '@/types'

const dateKeyOrUndefined = (raw: string | null | undefined) => (raw && raw.trim() ? toIstDateKey(raw) : undefined)
const textOrUndefined = (raw: string | number | null | undefined) => {
  const value = raw === null || raw === undefined ? '' : String(raw).trim()
  return value || undefined
}

/* ------------------------------------------------------------------ udhaar */

/** Rows without an id can't be edited or deleted safely, and rows without a person/amount aren't real entries. */
export function normalizeUdhaarRows(rows: RawUdhaar[]): UdhaarEntry[] {
  const entries: UdhaarEntry[] = []
  rows.forEach((row) => {
    const id = row.udhaarId?.trim()
    const person = row.person?.trim()
    const amount = Number(row.amount)
    const typeText = row.type?.trim().toLowerCase()
    if (!id || !person || !Number.isFinite(amount) || amount <= 0) return
    if (typeText !== 'given' && typeText !== 'repayment') return
    entries.push({
      id,
      person,
      type: typeText,
      amount,
      date: dateKeyOrUndefined(row.date) ?? dateKeyOrUndefined(row.timestamp) ?? todayIstDateKey(),
      dueDate: dateKeyOrUndefined(row.dueDate),
      description: textOrUndefined(row.description),
      paymentMethod: textOrUndefined(row.paymentMethod),
      note: textOrUndefined(row.note),
    })
  })
  return entries
}

const DUE_SOON_DAYS = 7

function addDays(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T00:00:00`)
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Mirrors the sheet's own Status formula: settled at ≤0 outstanding, else by the earliest due date. */
function statusFor(outstanding: number, dueDate: string | undefined, today: string): UdhaarStatus {
  if (outstanding <= 0) return 'settled'
  if (!dueDate) return 'pending'
  if (dueDate < today) return 'overdue'
  if (dueDate <= addDays(today, DUE_SOON_DAYS)) return 'due-soon'
  return 'pending'
}

/** Groups ledger entries by person (case-insensitive) into balances, largest outstanding first. */
export function groupUdhaarByPerson(entries: UdhaarEntry[]): UdhaarPerson[] {
  const today = todayIstDateKey()
  const byPerson = new Map<string, UdhaarEntry[]>()
  entries.forEach((entry) => {
    const key = entry.person.toLowerCase()
    byPerson.set(key, [...(byPerson.get(key) ?? []), entry])
  })

  return Array.from(byPerson.entries())
    .map(([key, personEntries]) => {
      const given = personEntries.filter((e) => e.type === 'given').reduce((sum, e) => sum + e.amount, 0)
      const repaid = personEntries.filter((e) => e.type === 'repayment').reduce((sum, e) => sum + e.amount, 0)
      const outstanding = given - repaid
      const dueDates = personEntries.map((e) => (e.type === 'given' ? e.dueDate : undefined)).filter((d): d is string => !!d)
      const dueDate = dueDates.sort()[0]
      return {
        id: key,
        name: personEntries[0].person,
        given,
        repaid,
        outstanding,
        dueDate,
        status: statusFor(outstanding, dueDate, today),
        entries: [...personEntries].sort((a, b) => (a.date < b.date ? 1 : -1)),
      }
    })
    .sort((a, b) => b.outstanding - a.outstanding || a.name.localeCompare(b.name))
}

export function summarizeUdhaar(people: UdhaarPerson[]): UdhaarSummary {
  return {
    totalGiven: people.reduce((sum, p) => sum + p.given, 0),
    totalRepaid: people.reduce((sum, p) => sum + p.repaid, 0),
    toReceive: people.reduce((sum, p) => sum + Math.max(0, p.outstanding), 0),
    overdue: people.filter((p) => p.status === 'overdue').reduce((sum, p) => sum + p.outstanding, 0),
  }
}

/** Create payload for Udhaar.gs (routed by recordType, not action). */
export function buildUdhaarCreatePayload(input: UdhaarEntryInput): Record<string, unknown> {
  return { recordType: 'Udhaar', ...buildUdhaarFields(input) }
}

export function buildUdhaarFields(input: UdhaarEntryInput): Record<string, unknown> {
  return {
    person: input.person,
    type: input.type === 'given' ? 'Given' : 'Repayment',
    amount: input.amount,
    date: input.date,
    dueDate: input.type === 'given' ? (input.dueDate ?? '') : '',
    description: input.description ?? '',
    paymentMethod: input.paymentMethod ?? '',
    note: input.note ?? '',
  }
}

/* ------------------------------------------------------------------- tasks */

const PRIORITIES: Record<string, TaskPriority> = { low: 'low', medium: 'medium', high: 'high', urgent: 'urgent' }
const STATUSES: TaskStatus[] = ['Todo', 'In Progress', 'Completed', 'Cancelled']

export function normalizeTask(raw: RawTask): Task {
  const statusText = raw.status?.trim() ?? ''
  const status = STATUSES.find((s) => s.toLowerCase() === statusText.toLowerCase()) ?? 'Todo'
  const completedFlag = raw.isCompleted === true || String(raw.isCompleted).toLowerCase() === 'true'
  return {
    id: raw.taskId,
    title: raw.title?.trim() || 'Untitled task',
    description: textOrUndefined(raw.description),
    dueDate: dateKeyOrUndefined(raw.dueDate),
    priority: PRIORITIES[raw.priority?.trim().toLowerCase() ?? ''] ?? 'medium',
    category: textOrUndefined(raw.category),
    status,
    completed: completedFlag || status === 'Completed',
  }
}

const titleCase = (p: TaskPriority) => p.charAt(0).toUpperCase() + p.slice(1)

export function buildTaskPayload(input: TaskInput): Record<string, unknown> {
  const completed = input.status === 'Completed'
  return {
    title: input.title,
    description: input.description ?? '',
    status: input.status,
    priority: titleCase(input.priority),
    dueDate: input.dueDate ?? '',
    category: input.category ?? '',
    isCompleted: completed,
    completedAt: completed ? new Date().toISOString() : '',
  }
}

/** Payload for ticking a task done/undone without touching its other fields. */
export function buildTaskCompletionPayload(completed: boolean): Record<string, unknown> {
  return {
    status: completed ? 'Completed' : 'Todo',
    isCompleted: completed,
    completedAt: completed ? new Date().toISOString() : '',
  }
}

/* --------------------------------------------------------------- documents */

export function normalizeDocument(raw: RawDocument): AppDocument {
  const categoryText = raw.category?.trim() ?? ''
  const category: DocumentCategory = DOCUMENT_CATEGORIES.find((c) => c.toLowerCase() === categoryText.toLowerCase()) ?? 'Other'
  return {
    id: raw.documentId,
    name: raw.name?.trim() || 'Untitled document',
    description: textOrUndefined(raw.description),
    category,
    date: dateKeyOrUndefined(raw.createdAt) ?? todayIstDateKey(),
    url: textOrUndefined(raw.driveUrl),
    fileType: textOrUndefined(raw.fileType),
    size: textOrUndefined(raw.size),
    tags: textOrUndefined(raw.tags),
  }
}

export function buildDocumentPayload(input: DocumentInput): Record<string, unknown> {
  return {
    name: input.name,
    description: input.description ?? '',
    category: input.category,
    driveUrl: input.url ?? '',
    fileType: input.fileType ?? '',
    tags: input.tags ?? '',
  }
}
