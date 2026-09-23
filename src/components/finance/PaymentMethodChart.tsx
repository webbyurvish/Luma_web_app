import { Card, CardHeader } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/formatCurrency'
import type { PaymentMethodBreakdown } from '@/types'

interface PaymentMethodChartProps {
  data: PaymentMethodBreakdown[]
}

export function PaymentMethodChart({ data }: PaymentMethodChartProps) {
  return (
    <Card hoverable>
      <CardHeader title="Payment methods" subtitle="Share of spending this month" />
      {data.length === 0 ? (
        <p className="py-6 text-center text-xs text-ink-muted">Not enough data yet.</p>
      ) : (
        <ul className="space-y-2.5">
          {data.map((method) => (
            <li key={method.method}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-ink-soft">{method.method}</span>
                <span className="font-mono-figure text-ink">
                  {formatCurrency(method.amount, { compact: true })} · {method.percentage}%
                </span>
              </div>
              <div className="h-[5px] w-full overflow-hidden rounded-xs bg-bg-soft">
                <div
                  className="h-full rounded-xs transition-all duration-700"
                  style={{ width: `${method.percentage}%`, backgroundColor: method.color }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
