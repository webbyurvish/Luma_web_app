import { motion } from 'framer-motion'
import { Card, CardHeader } from '@/components/ui/Card'
import { ChartCardSkeleton } from '@/components/ui/Skeleton'
import { formatCurrency } from '@/lib/formatCurrency'
import { mockCategoryBreakdown, mockFinanceSummary } from '@/data/mockExpenses'
import { fadeUp } from '@/lib/motion'

export function CategoryBars({ loading }: { loading?: boolean }) {
  if (loading) return <ChartCardSkeleton />

  const max = Math.max(...mockCategoryBreakdown.map((c) => c.amount))

  return (
    <Card hoverable className="h-full">
      <CardHeader
        title="Where it goes"
        subtitle={`${formatCurrency(mockFinanceSummary.totalExpense, { compact: true })} spent this month`}
      />
      <ul className="space-y-2.5">
        {mockCategoryBreakdown.map((entry, index) => (
          <motion.li key={entry.category} custom={index} variants={fadeUp} initial="hidden" animate="visible">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-ink-soft">{entry.label}</span>
              <span className="font-mono-figure text-ink">{formatCurrency(entry.amount, { compact: true })}</span>
            </div>
            <div className="h-[5px] overflow-hidden rounded-xs bg-bg-soft">
              <motion.div
                className="h-full rounded-xs"
                style={{ backgroundColor: entry.color }}
                initial={{ width: 0 }}
                animate={{ width: `${(entry.amount / max) * 100}%` }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.1 + index * 0.03 }}
              />
            </div>
          </motion.li>
        ))}
      </ul>
    </Card>
  )
}
