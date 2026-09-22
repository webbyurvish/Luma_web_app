import { motion } from 'framer-motion'
import { Card } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/formatCurrency'
import { fadeUp } from '@/lib/motion'
import type { NetWorthBreakdown } from '@/lib/financeCalculations'

interface NetWorthPanelProps {
  breakdown: NetWorthBreakdown
}

export function NetWorthPanel({ breakdown }: NetWorthPanelProps) {
  const rows: { label: string; value: number; color: string }[] = [
    { label: 'Cash & Bank', value: breakdown.cashAndBank, color: 'var(--color-success)' },
    { label: 'Investments', value: breakdown.investments, color: 'var(--color-rust)' },
    { label: 'Other assets', value: breakdown.otherAssets, color: 'var(--color-ai)' },
    { label: 'Udhaar receivable', value: breakdown.udhaarReceivable, color: 'var(--color-info)' },
  ]
  const max = Math.max(...rows.map((r) => r.value), breakdown.liabilities, 1)

  return (
    <Card variant="panel">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-muted">Net worth</p>
          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="mt-1.5 text-hero-value text-ink"
          >
            {formatCurrency(breakdown.netWorth)}
          </motion.p>
          <p className="mt-2.5 text-xs text-ink-muted">Assets minus liabilities</p>
        </div>

        <div className="shrink-0 border-t border-border-soft pt-3 text-left sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0 sm:text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Liabilities</p>
          <p className="mt-1.5 font-mono-figure text-lg text-danger">{formatCurrency(breakdown.liabilities, { compact: true })}</p>
        </div>
      </div>

      <div className="mt-6 space-y-2.5">
        {rows.map((row, index) => (
          <motion.div key={row.label} custom={index} variants={fadeUp} initial="hidden" animate="visible" className="flex items-center gap-3">
            <span className="w-28 shrink-0 text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-soft sm:w-32">{row.label}</span>
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
