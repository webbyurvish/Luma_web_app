import { useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { Card, CardHeader } from '@/components/ui/Card'
import { ChartCardSkeleton } from '@/components/ui/Skeleton'
import { formatCurrency } from '@/lib/formatCurrency'
import { formatFullDate, formatMonthYear, formatWeekday } from '@/lib/formatDate'
import { mockMonthlySpending, mockWeeklySpending } from '@/data/mockExpenses'
import { cn } from '@/lib/cn'
import type { SpendingPoint } from '@/types'

type Period = 'weekly' | 'monthly'

function ChartTooltip({ active, payload, period }: { active?: boolean; payload?: { value: number; payload: SpendingPoint }[]; period: Period }) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  return (
    <div className="relative overflow-hidden border border-border-soft bg-surface py-2 pl-3 pr-3.5 shadow-hover">
      <span className="absolute inset-y-0 left-0 w-[3px] bg-rust" aria-hidden="true" />
      <p className="text-[11px] font-medium text-ink">{period === 'weekly' ? formatWeekday(point.date) : formatMonthYear(point.date)}</p>
      {period === 'weekly' && <p className="text-[10px] text-ink-muted">{formatFullDate(point.date)}</p>}
      <p className="mt-1 font-mono-figure text-sm font-bold text-ink">{formatCurrency(payload[0].value)} spent</p>
    </div>
  )
}

function EndDot(props: { cx?: number; cy?: number; index?: number; dataLength: number }) {
  const { cx, cy, index, dataLength } = props
  if (index !== dataLength - 1 || cx === undefined || cy === undefined) return <g />
  return (
    <g>
      <circle cx={cx} cy={cy} r={7} fill="var(--color-rust)" opacity={0.14} />
      <circle cx={cx} cy={cy} r={3} fill="var(--color-rust)" stroke="var(--color-surface)" strokeWidth={1.5} />
    </g>
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
      <div className="h-[220px] w-full sm:h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="spendingFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-rust)" stopOpacity={0.24} />
                <stop offset="100%" stopColor="var(--color-rust)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--color-ink)" strokeOpacity={0.07} strokeDasharray="3 5" />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={({ x, y, payload }) => (
                <text
                  x={x}
                  y={Number(y) + 14}
                  textAnchor="middle"
                  fontSize={10.5}
                  fontFamily="var(--font-sans)"
                  fontWeight={payload.value === lastLabel ? 700 : 400}
                  fill={payload.value === lastLabel ? 'var(--color-rust)' : 'var(--color-ink-muted)'}
                >
                  {payload.value}
                </text>
              )}
            />
            <Tooltip content={<ChartTooltip period={period} />} cursor={{ stroke: 'var(--color-border)', strokeWidth: 1, strokeDasharray: '2 4' }} />
            <Area
              type="monotone"
              dataKey="expense"
              stroke="var(--color-rust)"
              strokeWidth={2}
              fill="url(#spendingFill)"
              animationDuration={700}
              animationEasing="ease-out"
              dot={(dotProps: { cx?: number; cy?: number; index?: number }) => (
                <EndDot key={dotProps.index} cx={dotProps.cx} cy={dotProps.cy} index={dotProps.index} dataLength={data.length} />
              )}
              activeDot={{ r: 4, stroke: 'var(--color-surface)', strokeWidth: 2, fill: 'var(--color-rust)' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
