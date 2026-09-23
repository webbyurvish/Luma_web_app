import { useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import type { PieProps } from 'recharts'
import { Card, CardHeader } from '@/components/ui/Card'
import { ChartCardSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency } from '@/lib/formatCurrency'
import { cn } from '@/lib/cn'
import { PieChart as PieChartIcon } from 'lucide-react'
import type { CategoryBreakdown } from '@/types'

interface CategoryDonutProps {
  loading?: boolean
  data: CategoryBreakdown[]
  totalExpense: number
}

export function CategoryDonut({ loading, data, totalExpense }: CategoryDonutProps) {
  const [hovered, setHovered] = useState<number | null>(null)

  if (loading) return <ChartCardSkeleton />

  const activeEntry = hovered !== null ? data[hovered] : null
  const activePercentage = activeEntry && totalExpense > 0 ? (activeEntry.amount / totalExpense) * 100 : null

  const handleEnter: NonNullable<PieProps['onMouseEnter']> = (_, index) => setHovered(index)
  const handleLeave = () => setHovered(null)

  return (
    <Card hoverable className="h-full">
      <CardHeader title="Where it goes" subtitle={`${formatCurrency(totalExpense, { compact: true })} spent this month`} />
      {data.length === 0 ? (
        <EmptyState
          icon={<PieChartIcon size={20} />}
          title="No spending yet"
          description="Expense categories will show up here once you have transactions."
        />
      ) : (
        <div className="flex flex-col items-center gap-5 sm:flex-row">
          <div className="relative h-[168px] w-[168px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="amount"
                  nameKey="label"
                  innerRadius={56}
                  outerRadius={80}
                  paddingAngle={2.5}
                  cornerRadius={5}
                  stroke="none"
                  isAnimationActive
                  animationDuration={750}
                  animationEasing="ease-out"
                  onMouseEnter={handleEnter}
                  onMouseLeave={handleLeave}
                >
                  {data.map((entry, index) => (
                    <Cell
                      key={entry.category}
                      fill={entry.color}
                      opacity={hovered === null || hovered === index ? 1 : 0.35}
                      style={{ transition: 'opacity 150ms ease' }}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
              <p className="font-mono-figure text-lg font-bold text-ink">
                {formatCurrency(activeEntry ? activeEntry.amount : totalExpense, { compact: true })}
              </p>
              <p className="truncate text-[10px] uppercase tracking-[0.05em] text-ink-muted">{activeEntry ? activeEntry.label : 'Total spent'}</p>
              {activePercentage !== null && <p className="mt-0.5 font-mono-figure text-[10px] text-ink-muted/80">{activePercentage.toFixed(1)}%</p>}
            </div>
          </div>

          <ul className="w-full flex-1 space-y-1.5">
            {data.map((entry, index) => (
              <li
                key={entry.category}
                onMouseEnter={() => setHovered(index)}
                onMouseLeave={() => setHovered(null)}
                className={cn(
                  'flex items-center justify-between gap-3 px-1.5 py-1 text-xs transition-colors duration-150',
                  hovered === index && 'bg-bg-soft',
                )}
              >
                <span className="flex min-w-0 items-center gap-2 text-ink-soft">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className={cn('truncate', hovered === index && 'font-medium text-ink')}>{entry.label}</span>
                </span>
                <span className="shrink-0 font-mono-figure text-ink">{formatCurrency(entry.amount, { compact: true })}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}
