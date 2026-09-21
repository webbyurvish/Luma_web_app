import { Card, CardHeader } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/formatCurrency'
import { mockPaymentMethods } from '@/data/mockExpenses'
import type { PaymentMethod } from '@/types'

const methodColor: Record<PaymentMethod, string> = {
  UPI: 'var(--color-info)',
  Card: 'var(--color-ai)',
  Cash: 'var(--color-success)',
  'Bank Transfer': 'var(--color-warning)',
  'Net Banking': 'var(--color-pink)',
}

export function PaymentMethodChart() {
  return (
    <Card hoverable>
      <CardHeader title="Payment Methods" subtitle="Share of spending this month" />
      <ul className="space-y-4">
        {mockPaymentMethods.map((method) => (
          <li key={method.method}>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="font-medium text-ink">{method.method}</span>
              <span className="text-ink-soft">
                {formatCurrency(method.amount, { compact: true })} · {method.percentage}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-pill bg-bg-soft">
              <div
                className="h-full rounded-pill transition-all duration-700"
                style={{ width: `${method.percentage}%`, backgroundColor: methodColor[method.method] }}
              />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}
