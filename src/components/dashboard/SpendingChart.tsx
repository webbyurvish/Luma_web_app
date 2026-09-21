import { useState } from 'react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { Card, CardHeader } from '@/components/ui/Card'
import { ChartCardSkeleton } from '@/components/ui/Skeleton'
import { formatCurrency } from '@/lib/formatCurrency'
import { mockMonthlySpending, mockWeeklySpending } from '@/data/mockExpenses'
import { cn } from '@/lib/cn'

type Period = 'weekly' | 'monthly'

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="border border-border bg-surface px-3 py-2 text-xs shadow-hover">
      <p className="text-ink-muted">{label}</p>
      <p className="mt-0.5 font-mono-figure font-bold text-ink">{formatCurrency(payload[0].value)}</p>
    </div>
  )
}

export function SpendingChart({ loading }: { loading?: boolean }) {
  const [period, setPeriod] = useState<Period>('weekly')
  const data = period === 'weekly' ? mockWeeklySpending : mockMonthlySpending
  const lastLabel = data[data.length - 1]?.label

  if (loading) return <ChartCardSkeleton />

  return (
    <Card hoverable className="h-full">
      <CardHeader
        title="Spending rhythm"
        subtitle={period === 'weekly' ? 'This week' : 'Last 7 months'}
        action={
          <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.06em]">
            {(['weekly', 'monthly'] as Period[]).map((option) => (
              <button
                key={option}
                onClick={() => setPeriod(option)}
                className={cn('pb-0.5 transition-colors', period === option ? 'border-b-2 border-rust text-ink' : 'text-ink-muted hover:text-ink-soft')}
              >
                {option}
              </button>
            ))}
          </div>
        }
      />
      <div className="h-36 w-full sm:h-40">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="spendingFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-rust)" stopOpacity={0.22} />
                <stop offset="100%" stopColor="var(--color-rust)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={({ x, y, payload }) => (
                <text
                  x={x}
                  y={Number(y) + 13}
                  textAnchor="middle"
                  fontSize={10}
                  fontFamily={payload.value === lastLabel ? 'var(--font-mono)' : 'var(--font-sans)'}
                  fontWeight={payload.value === lastLabel ? 700 : 400}
                  fill={payload.value === lastLabel ? 'var(--color-rust)' : 'var(--color-ink-muted)'}
                >
                  {payload.value}
                </text>
              )}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--color-border)', strokeWidth: 1, strokeDasharray: '2 4' }} />
            <Area
              type="monotone"
              dataKey="expense"
              stroke="var(--color-rust)"
              strokeWidth={1.75}
              fill="url(#spendingFill)"
              animationDuration={500}
              animationEasing="ease-out"
              activeDot={{ r: 3.5, stroke: 'var(--color-surface)', strokeWidth: 2, fill: 'var(--color-rust)' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
