import { CalendarClock } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency } from '@/lib/formatCurrency'
import { formatFullDate } from '@/lib/formatDate'
import type { UpcomingSip } from '@/lib/financeCalculations'
import type { FinancialAccount } from '@/types'

interface UpcomingSipsListProps {
  upcoming: UpcomingSip[]
  accounts: FinancialAccount[]
}

export function UpcomingSipsList({ upcoming, accounts }: UpcomingSipsListProps) {
  const platformName = (id?: string) => accounts.find((a) => a.id === id)?.name ?? 'Unassigned'

  return (
    <Card hoverable>
      <CardHeader title="Upcoming SIPs" subtitle="Next scheduled debits" />
      {upcoming.length === 0 ? (
        <EmptyState icon={<CalendarClock size={20} />} title="No upcoming SIPs" description="Active SIPs with a debit day will show up here." />
      ) : (
        <ul className="-mx-1.5 divide-y divide-border-soft">
          {upcoming.map(({ sip, nextDate }) => (
            <li key={sip.id} className="flex items-center gap-3 px-1.5 py-2.5">
              <div className="w-14 shrink-0">
                <p className="font-mono-figure text-xs font-bold text-rust">{formatFullDate(nextDate).split(' ').slice(0, 2).join(' ')}</p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-ink">{sip.fundName}</p>
                <p className="truncate text-[10.5px] text-ink-muted">{platformName(sip.platformAccountId)}</p>
              </div>
              <span className="shrink-0 font-mono-figure text-xs font-semibold text-ink">{formatCurrency(sip.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
