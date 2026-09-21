import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { Card, CardHeader } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/formatCurrency'
import { mockMonthlySpending } from '@/data/mockExpenses'

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-btn border border-border-soft bg-card px-3.5 py-2.5 text-xs shadow-hover">
      <p className="mb-1 font-medium text-ink-soft">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="flex items-center gap-1.5 font-medium text-ink">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: entry.color }} />
          {entry.name}: {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  )
}

export function IncomeExpenseChart() {
  return (
    <Card hoverable>
      <CardHeader title="Income vs Expense" subtitle="Last 7 months" />
      <div className="h-64 w-full sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={mockMonthlySpending} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={6}>
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }} dy={8} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--color-bg-soft)' }} />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} iconType="circle" iconSize={8} />
            <Bar dataKey="income" name="Income" fill="var(--color-success)" radius={[6, 6, 0, 0]} maxBarSize={22} animationDuration={700} />
            <Bar dataKey="expense" name="Expense" fill="var(--color-danger)" radius={[6, 6, 0, 0]} maxBarSize={22} animationDuration={700} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
