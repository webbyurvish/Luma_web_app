import { Area, AreaChart, ResponsiveContainer } from 'recharts'
import { Archive, Pencil } from 'lucide-react'
import { SlideOver } from '@/components/ui/SlideOver'
import { Button } from '@/components/ui/Button'
import { formatCurrency, formatPercentage } from '@/lib/formatCurrency'
import { formatFullDate } from '@/lib/formatDate'
import { INVESTMENT_TYPE_META } from '@/lib/investmentMeta'
import { cn } from '@/lib/cn'
import type { FinancialAccount, Investment } from '@/types'

interface InvestmentDetailProps {
  open: boolean
  investment: Investment | null
  accounts: FinancialAccount[]
  onClose: () => void
  onEdit: (investment: Investment) => void
  onArchive: (investment: Investment) => void
}

export function InvestmentDetail({ open, investment, accounts, onClose, onEdit, onArchive }: InvestmentDetailProps) {
  const platformName = investment ? accounts.find((a) => a.id === investment.platformAccountId)?.name : undefined
  const meta = investment ? INVESTMENT_TYPE_META[investment.type] : null
  const gain = investment ? investment.currentValue - investment.investedAmount : 0
  const returnPct = investment && investment.investedAmount > 0 ? (gain / investment.investedAmount) * 100 : 0
  const positive = gain >= 0
  const chartData = investment?.history?.map((value, index) => ({ index, value })) ?? []

  return (
    <SlideOver
      open={open && investment !== null}
      onClose={onClose}
      title={investment?.name ?? ''}
      subtitle={[meta?.label, platformName].filter(Boolean).join(' · ')}
      footer={
        investment && (
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" icon={<Archive size={13} />} onClick={() => onArchive(investment)}>
              Archive
            </Button>
            <Button type="button" size="sm" icon={<Pencil size={13} />} onClick={() => onEdit(investment)}>
              Edit
            </Button>
          </div>
        )
      }
    >
      {investment && (
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Current Value</p>
            <p className="mt-1 font-mono-figure text-2xl font-bold text-ink">{formatCurrency(investment.currentValue)}</p>
            <p className={cn('mt-1.5 flex items-center gap-1 font-mono-figure text-xs font-bold', positive ? 'text-success' : 'text-danger')}>
              {formatCurrency(gain, { signed: true, compact: true })}
              <span className="font-normal text-ink-muted">({formatPercentage(returnPct, { signed: true })})</span>
            </p>
            <p className="mt-1 text-[10px] text-ink-muted">Manually updated demo data — not a live market value.</p>
          </div>

          {chartData.length > 1 && (
            <div className="h-24 w-full rounded-sm border border-border-soft bg-surface p-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                  <defs>
                    <linearGradient id="investment-detail-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={positive ? 'var(--color-success)' : 'var(--color-danger)'} stopOpacity={0.25} />
                      <stop offset="100%" stopColor={positive ? 'var(--color-success)' : 'var(--color-danger)'} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={positive ? 'var(--color-success)' : 'var(--color-danger)'}
                    strokeWidth={1.75}
                    fill="url(#investment-detail-fill)"
                    animationDuration={600}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 border-t border-border-soft pt-4 text-xs">
            <div>
              <p className="text-[10px] uppercase tracking-[0.06em] text-ink-muted">Invested</p>
              <p className="mt-1 font-mono-figure font-semibold text-ink">{formatCurrency(investment.investedAmount)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.06em] text-ink-muted">Platform</p>
              <p className="mt-1 text-ink">{platformName ?? 'Not set'}</p>
            </div>
            {investment.quantity !== undefined && (
              <div>
                <p className="text-[10px] uppercase tracking-[0.06em] text-ink-muted">Quantity</p>
                <p className="mt-1 font-mono-figure text-ink">{investment.quantity}</p>
              </div>
            )}
            {investment.averagePrice !== undefined && (
              <div>
                <p className="text-[10px] uppercase tracking-[0.06em] text-ink-muted">Avg. Price</p>
                <p className="mt-1 font-mono-figure text-ink">{formatCurrency(investment.averagePrice)}</p>
              </div>
            )}
            {investment.currentPrice !== undefined && (
              <div>
                <p className="text-[10px] uppercase tracking-[0.06em] text-ink-muted">Current Price</p>
                <p className="mt-1 font-mono-figure text-ink">{formatCurrency(investment.currentPrice)}</p>
              </div>
            )}
            {investment.purchaseDate && (
              <div>
                <p className="text-[10px] uppercase tracking-[0.06em] text-ink-muted">Purchase Date</p>
                <p className="mt-1 text-ink">{formatFullDate(investment.purchaseDate)}</p>
              </div>
            )}
          </div>

          {investment.notes && (
            <div className="border-t border-border-soft pt-4">
              <p className="text-[10px] uppercase tracking-[0.06em] text-ink-muted">Notes</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-soft">{investment.notes}</p>
            </div>
          )}
        </div>
      )}
    </SlideOver>
  )
}
