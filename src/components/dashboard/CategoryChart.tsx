import { useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import { Card, CardHeader } from '@/components/ui/Card'
import { ChartCardSkeleton } from '@/components/ui/Skeleton'
import { formatCurrency } from '@/lib/formatCurrency'
import { mockCategoryBreakdown, mockFinanceSummary } from '@/data/mockExpenses'
import { cn } from '@/lib/cn'

export function CategoryChart({ loading }: { loading?: boolean }) {
  const [hovered, setHovered] = useState<number | null>(null)

  if (loading) return <ChartCardSkeleton />

  const activeEntry = hovered !== null ? mockCategoryBreakdown[hovered] : null

  return (
    <Card hoverable className="h-full">
      <CardHeader title="Where your money goes" subtitle="This month by category" />
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
        <div className="relative h-44 w-44 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={mockCategoryBreakdown}
                dataKey="amount"
                nameKey="label"
                innerRadius={54}
                outerRadius={78}
                paddingAngle={3}
                cornerRadius={6}
                animationDuration={700}
                animationEasing="ease-out"
                onMouseEnter={(_, index) => setHovered(index)}
                onMouseLeave={() => setHovered(null)}
              >
                {mockCategoryBreakdown.map((entry, index) => (
                  <Cell
                    key={entry.category}
                    fill={entry.color}
                    stroke="none"
                    opacity={hovered === null || hovered === index ? 1 : 0.35}
                    style={{ transition: 'opacity 180ms ease' }}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            {activeEntry ? (
              <>
                <p className="text-lg font-bold text-ink">{formatCurrency(activeEntry.amount, { compact: true })}</p>
                <p className="text-[11px] text-ink-soft">{activeEntry.label}</p>
              </>
            ) : (
              <>
                <p className="text-lg font-bold text-ink">{formatCurrency(mockFinanceSummary.totalExpense, { compact: true })}</p>
                <p className="text-[11px] text-ink-soft">Total spent</p>
              </>
            )}
          </div>
        </div>

        <ul className="w-full flex-1 space-y-2.5">
          {mockCategoryBreakdown.map((entry, index) => (
            <li
              key={entry.category}
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered(null)}
              className={cn(
                'flex items-center justify-between gap-3 rounded-md px-1.5 py-1 text-xs transition-colors duration-150',
                hovered === index && 'bg-bg-soft',
              )}
            >
              <span className="flex min-w-0 items-center gap-2 text-ink-soft">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className={cn('truncate', hovered === index && 'font-medium text-ink')}>{entry.label}</span>
              </span>
              <span className={cn('shrink-0 font-medium', hovered === index ? 'text-ink' : 'text-ink')}>
                {formatCurrency(entry.amount, { compact: true })}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}
