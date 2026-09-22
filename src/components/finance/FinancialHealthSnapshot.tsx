import { Card, CardHeader } from '@/components/ui/Card'
import { formatCurrency, formatPercentage } from '@/lib/formatCurrency'

interface HealthItem {
  label: string
  value: string
}

interface FinancialHealthSnapshotProps {
  monthlySip: number
  savingsRate: number
  investmentAllocationPct: number
  udhaarOutstanding: number
}

export function FinancialHealthSnapshot({ monthlySip, savingsRate, investmentAllocationPct, udhaarOutstanding }: FinancialHealthSnapshotProps) {
  const items: HealthItem[] = [
    { label: 'Monthly SIP', value: formatCurrency(monthlySip, { compact: true }) },
    { label: 'Savings Rate', value: formatPercentage(savingsRate) },
    { label: 'Investment Allocation', value: formatPercentage(investmentAllocationPct) },
    { label: 'Udhaar Outstanding', value: formatCurrency(udhaarOutstanding, { compact: true }) },
  ]

  return (
    <Card hoverable>
      <CardHeader title="Financial Health" subtitle="A quick snapshot" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {items.map((item) => (
          <div key={item.label}>
            <p className="text-[10px] uppercase tracking-[0.06em] text-ink-muted">{item.label}</p>
            <p className="mt-1 font-mono-figure text-base font-bold text-ink">{item.value}</p>
          </div>
        ))}
      </div>
    </Card>
  )
}
