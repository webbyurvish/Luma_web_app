import { RowActions } from '@/components/ui/RowActions'
import { Archive, Pencil, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/formatCurrency'
import type { FinancialAccount, SIP } from '@/types'

interface SipRowProps {
  sip: SIP
  platform?: FinancialAccount
  onEdit: (sip: SIP) => void
  onDeactivate: (sip: SIP) => void
  onDelete: (sip: SIP) => void
}

export function SipRow({ sip, platform, onEdit, onDeactivate, onDelete }: SipRowProps) {
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
      <RowActions
        label={`Actions for ${sip.fundName}`}
        actions={[
          { label: 'Edit', ariaLabel: `Edit ${sip.fundName}`, icon: <Pencil size={13} />, onClick: () => onEdit(sip) },
          { label: 'Deactivate', ariaLabel: `Deactivate ${sip.fundName}`, icon: <Archive size={13} />, onClick: () => onDeactivate(sip), tone: 'warning', hidden: !sip.isActive },
          { label: 'Delete', ariaLabel: `Delete ${sip.fundName} permanently`, icon: <Trash2 size={13} />, onClick: () => onDelete(sip), tone: 'danger' },
        ]}
      />
    </div>
  )
}
