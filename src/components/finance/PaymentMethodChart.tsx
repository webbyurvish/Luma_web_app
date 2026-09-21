import { Card, CardHeader } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/formatCurrency'
import { mockPaymentMethods } from '@/data/mockExpenses'
import type { PaymentMethod } from '@/types'

const methodColor: Record<PaymentMethod, string> = {
  UPI: 'var(--color-ai)',
  Card: 'var(--color-rust)',
  Cash: 'var(--color-success)',
  'Bank Transfer': 'var(--color-warning)',
  'Net Banking': 'var(--color-pink)',
}

export function PaymentMethodChart() {
  return (
    <Card hoverable>
      <CardHeader title="Payment methods" subtitle="Share of spending this month" />
      <ul className="space-y-2.5">
        {mockPaymentMethods.map((method) => (
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
                style={{ width: `${method.percentage}%`, backgroundColor: methodColor[method.method] }}
              />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}
