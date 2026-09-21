import { motion } from 'framer-motion'
import { Line, LineChart, ResponsiveContainer } from 'recharts'
import { ArrowUpRight, Sparkles } from 'lucide-react'
import { formatCurrency } from '@/lib/formatCurrency'
import { mockFinanceSummary, mockSpendingInsight } from '@/data/mockExpenses'
import { fadeUp } from '@/lib/motion'

export function BalanceHeroCard() {
  const trendData = mockSpendingInsight.trendPoints.map((value, index) => ({ index, value }))

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="relative flex h-full min-h-[280px] flex-col justify-between overflow-hidden rounded-hero bg-gradient-gold p-7 text-white shadow-gold"
    >
      {/* decorative orbit ring */}
      <svg
        className="pointer-events-none absolute -right-10 -top-16 h-64 w-64 opacity-25"
        viewBox="0 0 200 200"
        fill="none"
        aria-hidden="true"
      >
        <ellipse cx="100" cy="100" rx="92" ry="46" stroke="white" strokeWidth="1.2" transform="rotate(-24 100 100)" />
        <ellipse cx="100" cy="100" rx="70" ry="34" stroke="white" strokeWidth="1" transform="rotate(-24 100 100)" opacity="0.6" />
      </svg>
      <Sparkles className="pointer-events-none absolute right-8 top-8 opacity-40" size={22} aria-hidden="true" />
      <span className="pointer-events-none absolute bottom-10 right-16 h-1.5 w-1.5 rounded-full bg-white/70" aria-hidden="true" />
      <span className="pointer-events-none absolute bottom-16 right-10 h-1 w-1 rounded-full bg-white/50" aria-hidden="true" />

      <div className="relative z-10">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/75">Current Balance</p>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm">
            <Sparkles size={15} className="text-white" />
          </span>
        </div>

        <p className="mt-5 text-[42px] font-bold leading-none tracking-tight sm:text-[48px]">
          {formatCurrency(mockFinanceSummary.currentBalance)}
        </p>

        <div className="mt-4 inline-flex items-center gap-1.5 rounded-pill bg-white/18 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
          <ArrowUpRight size={13} />
          {mockFinanceSummary.balanceTrend}% from last month
        </div>
      </div>

      <div className="relative z-10 mt-6 flex items-end justify-between gap-4">
        <p className="max-w-[220px] text-xs leading-relaxed text-white/75">{mockSpendingInsight.headline} — mock insight for now.</p>
        <div className="h-10 w-24 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
              <Line type="monotone" dataKey="value" stroke="white" strokeOpacity={0.85} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </motion.div>
  )
}
