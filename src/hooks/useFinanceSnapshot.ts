import { useMemo } from 'react'
import { useAccounts, useInvestments, useLiabilities, useSips } from './useFinanceCollections'
import { useTasks, useUdhaar } from './useLifeCollections'
import { useTransactions } from './useTransactions'
import { getMonthlySipTotal, getNetWorth } from '@/lib/financeCalculations'
import { todayIstDateKey } from '@/lib/formatDate'
import type { Transaction } from '@/types'

const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`
const monthKey = (date: string) => date.slice(0, 7)

function monthTotals(transactions: Transaction[]) {
  const byMonth = new Map<string, { income: number; expense: number; categories: Map<string, number> }>()
  transactions.forEach((t) => {
    const key = monthKey(t.date)
    const bucket = byMonth.get(key) ?? { income: 0, expense: 0, categories: new Map<string, number>() }
    if (t.type === 'income') bucket.income += t.amount
    if (t.type === 'expense') {
      bucket.expense += t.amount
      const category = t.rawCategory ?? t.category
      bucket.categories.set(category, (bucket.categories.get(category) ?? 0) + t.amount)
    }
    byMonth.set(key, bucket)
  })
  return byMonth
}

/**
 * Everything the Assistant is allowed to know, as a compact plain-text snapshot built from the
 * data already loaded in the app. Sent with each question instead of raw sheet rows, so the
 * prompt stays small and no notes/document contents leave the app.
 */
export function useFinanceSnapshot() {
  const { transactions, loading: txLoading } = useTransactions()
  const { accounts, loading: accLoading } = useAccounts()
  const { investments, loading: invLoading } = useInvestments()
  const { sips, loading: sipLoading } = useSips()
  const { liabilities, loading: liaLoading } = useLiabilities()
  const { people, summary: udhaar, loading: udhLoading } = useUdhaar()
  const { tasks, loading: taskLoading } = useTasks()

  const loading = txLoading || accLoading || invLoading || sipLoading || liaLoading || udhLoading || taskLoading

  const snapshot = useMemo(() => {
    const today = todayIstDateKey()
    const lines: string[] = [`Today: ${today}`]

    const worth = getNetWorth({ accounts, investments, liabilities, udhaarReceivable: udhaar.toReceive })
    lines.push(
      '',
      '## Net worth',
      `Net worth ${rupees(worth.netWorth)} = cash & bank ${rupees(worth.cashAndBank)} + investments ${rupees(worth.investments)} + other assets ${rupees(worth.otherAssets)} + udhaar receivable ${rupees(worth.udhaarReceivable)} − liabilities ${rupees(worth.liabilities)}`,
    )

    const months = monthTotals(transactions)
    const recentMonths = Array.from(months.keys()).sort().reverse().slice(0, 6)
    lines.push('', '## Income & expenses by month (newest first)')
    recentMonths.forEach((key) => {
      const m = months.get(key)!
      const topCategories = Array.from(m.categories.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([name, amount]) => `${name} ${rupees(amount)}`)
        .join(', ')
      lines.push(`${key}: income ${rupees(m.income)}, expense ${rupees(m.expense)}${topCategories ? ` — by category: ${topCategories}` : ''}`)
    })

    const recent = [...transactions].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 40)
    lines.push('', `## Latest ${recent.length} transactions (of ${transactions.length})`)
    recent.forEach((t) => {
      const detail = [t.rawCategory ?? t.category, t.rawSubcategory, t.merchant, t.payment !== 'Other' ? t.payment : undefined].filter(Boolean).join(' / ')
      lines.push(`${t.date} ${t.type} ${rupees(t.amount)} — ${detail}`)
    })

    const activeAccounts = accounts.filter((a) => a.isActive)
    lines.push('', '## Accounts')
    activeAccounts.forEach((a) => lines.push(`${a.name} (${a.type}${a.institution ? `, ${a.institution}` : ''}): ${rupees(a.balance)}${a.type === 'credit_card' ? ' outstanding' : ''}`))
    if (!activeAccounts.length) lines.push('None')

    lines.push('', '## Investments')
    investments.forEach((i) => lines.push(`${i.name} (${i.type}): invested ${rupees(i.investedAmount)}, now ${rupees(i.currentValue)}`))
    if (!investments.length) lines.push('None')

    const activeSips = sips.filter((s) => s.isActive)
    lines.push('', `## SIPs — ${rupees(getMonthlySipTotal(sips))}/month active`)
    activeSips.forEach((s) => lines.push(`${s.fundName}: ${rupees(s.amount)} ${s.frequency}${s.debitDay ? `, day ${s.debitDay}` : ''}`))
    if (!activeSips.length) lines.push('None active')

    lines.push('', '## Liabilities')
    liabilities.forEach((l) => lines.push(`${l.name} (${l.type}): ${rupees(l.amount)}`))
    if (!liabilities.length) lines.push('None besides credit cards above')

    lines.push('', `## Udhaar (money lent) — to receive ${rupees(udhaar.toReceive)}, overdue ${rupees(udhaar.overdue)}`)
    people.forEach((p) =>
      lines.push(`${p.name}: given ${rupees(p.given)}, repaid ${rupees(p.repaid)}, outstanding ${rupees(p.outstanding)}, ${p.status}${p.dueDate ? `, due ${p.dueDate}` : ''}`),
    )
    if (!people.length) lines.push('None')

    const openTasks = tasks.filter((t) => !t.completed && t.status !== 'Cancelled').slice(0, 25)
    lines.push('', `## Open tasks (${openTasks.length})`)
    openTasks.forEach((t) => lines.push(`${t.title}${t.dueDate ? ` — due ${t.dueDate}` : ''} [${t.priority}]`))

    return lines.join('\n')
  }, [transactions, accounts, investments, sips, liabilities, people, udhaar, tasks])

  return { snapshot, loading }
}
