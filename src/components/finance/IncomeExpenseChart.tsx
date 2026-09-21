import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { Card, CardHeader } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/formatCurrency'
import { mockMonthlySpending } from '@/data/mockExpenses'

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="border border-border bg-surface px-3 py-2 text-xs shadow-hover">
      <p className="mb-1 text-ink-muted">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="flex items-center gap-1.5 font-mono-figure font-bold text-ink">
          <span className="h-1.5 w-1.5" style={{ backgroundColor: entry.color }} />
          {entry.name}: {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  )
}

export function IncomeExpenseChart() {
  return (
    <Card hoverable>
      <CardHeader
        title="Income vs Expense"
        subtitle="Last 7 months"
        action={
          <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.05em] text-ink-soft">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5" style={{ backgroundColor: 'var(--color-success)' }} /> Income
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5" style={{ backgroundColor: 'var(--color-rust)' }} /> Expense
            </span>
          </div>
        }
      />
      <div className="h-44 w-full sm:h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={mockMonthlySpending} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barGap={4}>
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--color-ink-muted)' }} dy={6} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--color-bg-soft)' }} />
            <Bar dataKey="income" name="Income" fill="var(--color-success)" maxBarSize={16} animationDuration={500} />
            <Bar dataKey="expense" name="Expense" fill="var(--color-rust)" maxBarSize={16} animationDuration={500} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
