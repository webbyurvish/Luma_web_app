import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { Card, CardHeader } from '@/components/ui/Card'
import { ChartCardSkeleton } from '@/components/ui/Skeleton'
import { formatCurrency } from '@/lib/formatCurrency'
import { mockCategoryBreakdown, mockFinanceSummary } from '@/data/mockExpenses'

function DonutTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  return (
    <div className="rounded-btn border border-border bg-card px-3 py-2 text-xs shadow-hover">
      <p className="font-medium text-ink-soft">{item.name}</p>
      <p className="mt-0.5 font-semibold text-ink">{formatCurrency(item.value)}</p>
    </div>
  )
}

export function CategoryChart({ loading }: { loading?: boolean }) {
  if (loading) return <ChartCardSkeleton />

  return (
    <Card className="h-full">
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
                animationDuration={600}
              >
                {mockCategoryBreakdown.map((entry) => (
                  <Cell key={entry.category} fill={entry.color} stroke="none" />
                ))}
              </Pie>
              <Tooltip content={<DonutTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-lg font-bold text-ink">{formatCurrency(mockFinanceSummary.totalExpense, { compact: true })}</p>
            <p className="text-[11px] text-ink-soft">Total spent</p>
          </div>
        </div>

        <ul className="w-full flex-1 space-y-2.5">
          {mockCategoryBreakdown.map((entry) => (
            <li key={entry.category} className="flex items-center justify-between gap-3 text-xs">
              <span className="flex min-w-0 items-center gap-2 text-ink-soft">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="truncate">{entry.label}</span>
              </span>
              <span className="shrink-0 font-medium text-ink">{formatCurrency(entry.amount, { compact: true })}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}
