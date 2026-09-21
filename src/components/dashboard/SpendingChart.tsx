import { useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { Card, CardHeader } from '@/components/ui/Card'
import { ChartCardSkeleton } from '@/components/ui/Skeleton'
import { formatCurrency } from '@/lib/formatCurrency'
import { mockMonthlySpending, mockWeeklySpending } from '@/data/mockExpenses'
import { cn } from '@/lib/cn'

type Period = 'weekly' | 'monthly'

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-btn border border-border bg-card px-3 py-2 text-xs shadow-hover">
      <p className="font-medium text-ink-soft">{label}</p>
      <p className="mt-0.5 font-semibold text-ink">{formatCurrency(payload[0].value)}</p>
    </div>
  )
}

export function SpendingChart({ loading }: { loading?: boolean }) {
  const [period, setPeriod] = useState<Period>('weekly')
  const data = period === 'weekly' ? mockWeeklySpending : mockMonthlySpending

  if (loading) return <ChartCardSkeleton />

  return (
    <Card className="h-full">
      <CardHeader
        title="Spending Overview"
        subtitle={period === 'weekly' ? 'This week' : 'Last 7 months'}
        action={
          <div className="flex items-center rounded-pill bg-bg-soft p-1 text-xs font-medium">
            {(['weekly', 'monthly'] as Period[]).map((option) => (
              <button
                key={option}
                onClick={() => setPeriod(option)}
                className={cn(
                  'rounded-pill px-3 py-1.5 capitalize transition-colors',
                  period === option ? 'bg-card text-ink shadow-xs' : 'text-ink-soft hover:text-ink',
                )}
              >
                {option}
              </button>
            ))}
          </div>
        }
      />
      <div className="h-56 w-full sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="spendingFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-gold)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--color-gold)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="4 8" />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }}
              dy={8}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--color-border)', strokeWidth: 1 }} />
            <Area
              type="monotone"
              dataKey="expense"
              stroke="var(--color-gold-dark)"
              strokeWidth={2.5}
              fill="url(#spendingFill)"
              animationDuration={600}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
