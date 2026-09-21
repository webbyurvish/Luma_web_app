import { Line, LineChart, ResponsiveContainer } from 'recharts'
import { TrendingDown } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { mockSpendingInsight } from '@/data/mockExpenses'

export function SpendingTrendCard() {
  const chartData = mockSpendingInsight.trendPoints.map((value, index) => ({ index, value }))

  return (
    <Card className="flex h-full flex-col justify-between">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-ink-soft">Your spending trend</p>
          <p className="mt-2 text-sm font-semibold leading-snug text-ink">{mockSpendingInsight.headline}</p>
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
          <TrendingDown size={17} />
        </span>
      </div>

      <div className="mt-4 h-12 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
            <Line type="monotone" dataKey="value" stroke="var(--color-success)" strokeWidth={2} dot={false} animationDuration={600} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-[10px] text-ink-muted">Mock insight — AI-generated insights arrive in a later phase</p>
    </Card>
  )
}
