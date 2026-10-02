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
    <>
    {/* Phones: one row per holding — name, type and value without sideways scrolling. */}
    <ul className="-mx-1 divide-y divide-border-soft sm:hidden">
      {investments.map((investment) => {
        const meta = INVESTMENT_TYPE_META[investment.type]
        const gain = investment.currentValue - investment.investedAmount
        const pct = investment.investedAmount ? (gain / investment.investedAmount) * 100 : 0
        return (
          <li key={investment.id}>
            <button type="button" onClick={() => onSelect(investment)} className="flex w-full items-center gap-3 px-1 py-3 text-left">
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-[13px] font-medium leading-snug text-ink">{investment.name}</span>
                <span className="mt-0.5 block truncate text-[11px] text-ink-muted">
                  <span className="font-semibold uppercase tracking-[0.05em]" style={{ color: meta.color }}>
                    {meta.label}
                  </span>{' '}
                  · {platformName(investment.platformAccountId)}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-mono-figure text-[13px] font-semibold text-ink">{formatCurrency(investment.currentValue)}</span>
                <span className={cn('block font-mono-figure text-[11px] font-semibold', gain >= 0 ? 'text-success' : 'text-danger')}>
                  {formatCurrency(gain, { signed: true })} ({pct >= 0 ? '+' : ''}
                  {pct.toFixed(1)}%)
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>

    <div className="hidden overflow-x-auto sm:block">
      <table className="w-full min-w-[520px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
            <th className="py-2 pl-2 pr-3 font-semibold">Investment</th>
            <th className="py-2 pr-3 font-semibold">Type</th>
            <th className="py-2 pr-3 font-semibold">Platform</th>
            <th className="py-2 pr-3 text-right font-semibold">Invested</th>
            <th className="py-2 pr-3 text-right font-semibold">Current</th>
            <th className="py-2 pr-2 text-right font-semibold">Gain</th>
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
                <td className="py-2.5 pl-2 pr-3 font-medium text-ink">{investment.name}</td>
                <td className="py-2.5 pr-3 text-[10px] font-semibold uppercase tracking-[0.05em]" style={{ color: meta.color }}>
                  {meta.label}
                </td>
                <td className="py-2.5 pr-3 text-ink-soft">{platformName(investment.platformAccountId)}</td>
                <td className="py-2.5 pr-3 text-right font-mono-figure text-ink-soft">{formatCurrency(investment.investedAmount)}</td>
                <td className="py-2.5 pr-3 text-right font-mono-figure font-semibold text-ink">{formatCurrency(investment.currentValue)}</td>
                <td className={cn('py-2.5 pr-2 text-right font-mono-figure font-semibold', gain >= 0 ? 'text-success' : 'text-danger')}>
                  {formatCurrency(gain, { signed: true })}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
    </>
  )
}
