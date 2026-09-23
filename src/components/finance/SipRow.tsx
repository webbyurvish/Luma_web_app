import { Badge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/formatCurrency'
import type { FinancialAccount, SIP } from '@/types'

interface SipRowProps {
  sip: SIP
  platform?: FinancialAccount
}

export function SipRow({ sip, platform }: SipRowProps) {
  return (
    <div className="flex items-center gap-3 rounded-xs px-2 py-2.5 transition-colors hover:bg-ink/[0.04]">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-xs font-medium text-ink">{sip.fundName}</p>
          {!sip.isActive && (
            <Badge variant="neutral" className="shrink-0">
              Paused
            </Badge>
          )}
        </div>
        <p className="truncate text-[10.5px] text-ink-muted">
          {platform?.name ?? 'Unassigned'}
          {sip.debitDay && <> · Day {sip.debitDay}</>} · {sip.frequency === 'monthly' ? 'Monthly' : 'Quarterly'}
        </p>
      </div>
      <span className="shrink-0 font-mono-figure text-xs font-semibold text-ink">{formatCurrency(sip.amount)}</span>
    </div>
  )
}
