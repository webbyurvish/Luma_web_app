import { Archive, Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/formatCurrency'
import type { FinancialAccount, SIP } from '@/types'

interface SipRowProps {
  sip: SIP
  platform?: FinancialAccount
  onEdit: (sip: SIP) => void
  onDeactivate: (sip: SIP) => void
}

export function SipRow({ sip, platform, onEdit, onDeactivate }: SipRowProps) {
  return (
    <div className="group flex items-center gap-3 rounded-xs px-2 py-2.5 transition-colors hover:bg-ink/[0.04]">
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
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <button
          type="button"
          onClick={() => onEdit(sip)}
          aria-label={`Edit ${sip.fundName}`}
          className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-bg-soft hover:text-ink"
        >
          <Pencil size={13} />
        </button>
        {sip.isActive && (
          <button
            type="button"
            onClick={() => onDeactivate(sip)}
            aria-label={`Deactivate ${sip.fundName}`}
            className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-danger-soft hover:text-danger"
          >
            <Archive size={13} />
          </button>
        )}
      </div>
    </div>
  )
}
