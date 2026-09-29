import { Card, CardHeader } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/formatCurrency'
import type { SipGroup } from '@/lib/financeCalculations'

const BAR_COLORS = ['var(--color-rust)', 'var(--color-ai)', 'var(--color-success)', 'var(--color-warning)', 'var(--color-pink)', 'var(--color-cyan)']

interface SipContributionBarsProps {
  title: string
  subtitle?: string
  groups: SipGroup[]
}

export function SipContributionBars({ title, subtitle, groups }: SipContributionBarsProps) {
  const max = Math.max(...groups.map((g) => g.amount), 1)

  return (
    <Card hoverable>
      <CardHeader title={title} subtitle={subtitle} />
      {groups.length === 0 ? (
        <p className="py-4 text-center text-xs text-ink-muted">Not enough data yet.</p>
      ) : (
        <ul className="space-y-2.5">
          {groups.map((group, index) => (
            <li key={group.key}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="truncate text-ink-soft">{group.label}</span>
                <span className="font-mono-figure text-ink">{formatCurrency(group.amount, { compact: true })}</span>
              </div>
              <div className="h-[5px] overflow-hidden rounded-xs bg-bg-soft">
                <div
                  className="h-full rounded-xs transition-all duration-700"
                  style={{ width: `${(group.amount / max) * 100}%`, backgroundColor: BAR_COLORS[index % BAR_COLORS.length] }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
