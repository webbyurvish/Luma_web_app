import { LineChart } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency } from '@/lib/formatCurrency'
import { INVESTMENT_TYPE_META } from '@/lib/investmentMeta'
import { cn } from '@/lib/cn'
import type { FinancialAccount, Investment } from '@/types'

interface HoldingsTableProps {
  investments: Investment[]
  accounts: FinancialAccount[]
  onSelect: (investment: Investment) => void
}

export function HoldingsTable({ investments, accounts, onSelect }: HoldingsTableProps) {
  if (investments.length === 0) {
    return <EmptyState icon={<LineChart size={22} />} title="No investments yet" description="Add a fund, stock, or deposit to start tracking your portfolio." />
  }

  const platformName = (id?: string) => accounts.find((a) => a.id === id)?.name ?? '—'

  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[520px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
            <th className="py-2 pr-3 font-semibold">Investment</th>
            <th className="py-2 pr-3 font-semibold">Type</th>
            <th className="py-2 pr-3 font-semibold">Platform</th>
            <th className="py-2 pr-3 text-right font-semibold">Invested</th>
            <th className="py-2 pr-3 text-right font-semibold">Current</th>
            <th className="py-2 text-right font-semibold">Gain</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-soft">
          {investments.map((investment) => {
            const meta = INVESTMENT_TYPE_META[investment.type]
            const gain = investment.currentValue - investment.investedAmount
            return (
              <tr
                key={investment.id}
                onClick={() => onSelect(investment)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onSelect(investment)
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`View ${investment.name}`}
                className="cursor-pointer transition-colors hover:bg-bg-soft focus-visible:bg-bg-soft"
              >
                <td className="py-2.5 pr-3 font-medium text-ink">{investment.name}</td>
                <td className="py-2.5 pr-3 text-[10px] font-semibold uppercase tracking-[0.05em]" style={{ color: meta.color }}>
                  {meta.label}
                </td>
                <td className="py-2.5 pr-3 text-ink-soft">{platformName(investment.platformAccountId)}</td>
                <td className="py-2.5 pr-3 text-right font-mono-figure text-ink-soft">{formatCurrency(investment.investedAmount)}</td>
                <td className="py-2.5 pr-3 text-right font-mono-figure font-semibold text-ink">{formatCurrency(investment.currentValue)}</td>
                <td className={cn('py-2.5 text-right font-mono-figure font-semibold', gain >= 0 ? 'text-success' : 'text-danger')}>
                  {formatCurrency(gain, { signed: true })}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
