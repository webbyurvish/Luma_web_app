import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/formatCurrency'
import { fadeUp } from '@/lib/motion'
import type { FinanceSummary } from '@/types'

interface OverviewBandProps {
  summary: FinanceSummary
  showUdhaar?: boolean
}

export function OverviewBand({ summary, showUdhaar = true }: OverviewBandProps) {
  const positive = summary.balanceTrend >= 0
  const max = Math.max(summary.totalIncome, summary.currentBalance, summary.totalExpense)

  const rows: { label: string; value: number; color: string }[] = [
    { label: 'Income', value: summary.totalIncome, color: 'var(--color-success)' },
    { label: 'Expense', value: summary.totalExpense, color: 'var(--color-rust)' },
    { label: 'Remaining', value: summary.currentBalance, color: 'var(--color-ink)' },
  ]

  return (
    <Card variant="panel">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-muted">Available balance</p>
          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="mt-1.5 font-mono-figure text-[36px] font-bold leading-none text-ink sm:text-[42px]"
          >
            {formatCurrency(summary.currentBalance)}
          </motion.p>
          <p className="mt-2.5 flex items-center gap-1 text-xs">
            <span className={`flex items-center gap-0.5 font-mono-figure font-bold ${positive ? 'text-success' : 'text-danger'}`}>
              {positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {Math.abs(summary.balanceTrend)}%
            </span>
            <span className="text-ink-muted">vs last month</span>
          </p>
        </div>

        {showUdhaar && (
          <Link
            to="/udhaar"
            className="shrink-0 border-t border-border-soft pt-3 text-left transition-opacity hover:opacity-70 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0 sm:text-right"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Udhaar receivable</p>
            <p className="mt-1.5 font-mono-figure text-lg text-ink">{formatCurrency(summary.udhaarReceivable, { compact: true })}</p>
          </Link>
        )}
      </div>

      <div className="mt-6 space-y-2.5">
        {rows.map((row, index) => (
          <motion.div key={row.label} custom={index} variants={fadeUp} initial="hidden" animate="visible" className="flex items-center gap-3">
            <span className="w-16 shrink-0 text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-soft sm:w-20">{row.label}</span>
            <div className="h-[5px] flex-1 overflow-hidden rounded-xs bg-bg-soft">
              <motion.div
                className="h-full rounded-xs"
                style={{ backgroundColor: row.color }}
                initial={{ width: 0 }}
                animate={{ width: `${(row.value / max) * 100}%` }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
              />
            </div>
            <span className="w-20 shrink-0 text-right font-mono-figure text-xs text-ink sm:w-24">{formatCurrency(row.value, { compact: true })}</span>
          </motion.div>
        ))}
      </div>
    </Card>
  )
}
