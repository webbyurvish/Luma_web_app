import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { useBudgets } from '@/hooks/usePlanning'
import { budgetUsage } from '@/lib/planning'
import { formatCurrency } from '@/lib/formatCurrency'
import { fadeUp } from '@/lib/motion'
import type { FinanceSummary, Transaction } from '@/types'

/**
 * Home's one bold panel: what you've spent this month, against your budgets when you have them,
 * on the deep hero colour. Everything else on the page stays quiet around it.
 */
export function HomeHero({ summary, transactions, monthKey, monthLabel }: { summary: FinanceSummary; transactions: Transaction[]; monthKey: string; monthLabel: string }) {
  const { budgets } = useBudgets()
  const usage = budgetUsage(budgets.filter((b) => b.isActive), transactions, monthKey)
  const limit = usage.reduce((s, u) => s + u.budget.monthlyLimit, 0)
  const budgeted = usage.reduce((s, u) => s + u.spent, 0)
  const over = usage.filter((u) => u.state === 'over').length
  const prev = summary.totalExpense && summary.expenseTrend ? summary.expenseTrend : null
  const barRatio = limit > 0 ? budgeted / limit : summary.totalIncome > 0 ? summary.totalExpense / summary.totalIncome : 0

  return (
    <motion.section
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="relative overflow-hidden rounded-hero bg-hero p-5 text-hero-ink shadow-hero ring-1 ring-inset ring-hero-line sm:p-6"
    >
      {/* faint ledger rules, the paper motif carried onto the panel */}
      <span
        className="pointer-events-none absolute inset-y-0 right-0 w-1/2 opacity-70"
        style={{ backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0 27px, var(--color-hero-line) 27px 28px)', maskImage: 'linear-gradient(to left, black 10%, transparent)' }}
        aria-hidden="true"
      />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-hero-muted">Spent in {monthLabel}</p>
          <p className="mt-1 font-display text-[40px] italic leading-none tracking-tight sm:text-[48px]">{formatCurrency(summary.totalExpense)}</p>
          {prev !== null && Number.isFinite(prev) && (
            <p className="mt-2 flex items-center gap-1 text-xs text-hero-muted">
              {prev > 0 ? <ArrowUpRight size={13} className="text-amber" /> : <ArrowDownRight size={13} className="text-amber" />}
              {Math.round(Math.abs(prev))}% {prev > 0 ? 'more' : 'less'} than last month
            </p>
          )}
        </div>
        <div className="grid grid-cols-3 gap-4 border-t border-hero-line pt-4 sm:flex sm:gap-6 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
          <Figure label="Income" value={formatCurrency(summary.totalIncome, { compact: true })} />
          <Figure label="Left" value={formatCurrency(summary.currentBalance, { compact: true })} />
          <Link to="/udhaar" className="transition-opacity hover:opacity-80">
            <Figure label="Owed to you" value={formatCurrency(summary.udhaarReceivable, { compact: true })} />
          </Link>
        </div>
      </div>

      <div className="relative mt-5">
        <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[11px] text-hero-muted">
          <span>
            {limit > 0 ? (
              <>
                <span className="font-mono-figure text-hero-ink">{formatCurrency(budgeted)}</span> of {formatCurrency(limit)} budgeted
              </>
            ) : (
              'Spent out of income'
            )}
          </span>
          <span className="font-mono-figure">{over ? `${over} budget${over === 1 ? '' : 's'} over` : `${Math.round(Math.min(barRatio, 9.99) * 100)}%`}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-hero-track" role="progressbar" aria-valuenow={Math.round(barRatio * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={limit > 0 ? 'Budget used' : 'Income spent'}>
          <motion.div
            className="h-full rounded-full bg-amber"
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, barRatio * 100)}%` }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
          />
        </div>
      </div>
    </motion.section>
  )
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-hero-muted">{label}</p>
      <p className="mt-0.5 truncate font-mono-figure text-[15px] font-semibold text-hero-ink">{value}</p>
    </div>
  )
}
