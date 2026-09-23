import { CalendarClock } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency } from '@/lib/formatCurrency'
import { formatFullDate, todayIstDateKey } from '@/lib/formatDate'
import { getUpcomingSips } from '@/lib/financeCalculations'
import { mockUdhaarPeople } from '@/data/mockUdhaar'
import { useAccounts, useSips } from '@/hooks/useFinanceCollections'
import { cn } from '@/lib/cn'

interface UpcomingItem {
  date: string
  label: string
  detail: string
  amount: number
  kind: 'sip' | 'udhaar'
}

export function UpcomingFinance() {
  const { sips } = useSips()
  const { accounts } = useAccounts()

  const platformName = (id?: string) => accounts.find((a) => a.id === id)?.name ?? 'Unassigned'
  const today = todayIstDateKey()

  const sipItems: UpcomingItem[] = getUpcomingSips(sips, today, 3).map(({ sip, nextDate }) => ({
    date: nextDate,
    label: sip.fundName,
    detail: `${platformName(sip.platformAccountId)} SIP`,
    amount: sip.amount,
    kind: 'sip',
  }))

  const udhaarItems: UpcomingItem[] = mockUdhaarPeople
    .filter((p) => p.outstanding > 0 && p.dueDate >= today)
    .map((p) => ({ date: p.dueDate, label: p.name, detail: 'Udhaar due', amount: p.outstanding, kind: 'udhaar' }))

  const items = [...sipItems, ...udhaarItems].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(0, 6)

  return (
    <Card hoverable className="h-full">
      <CardHeader title="Upcoming" subtitle="SIPs and money due" />
      {items.length === 0 ? (
        <EmptyState icon={<CalendarClock size={20} />} title="Nothing upcoming" description="Scheduled SIPs and dues will show up here." />
      ) : (
        <ul className="-mx-1.5 divide-y divide-border-soft">
          {items.map((item, index) => (
            <li key={`${item.kind}-${index}`} className="flex items-center gap-3 px-1.5 py-2.5">
              <div className="w-14 shrink-0">
                <p className="font-mono-figure text-xs font-bold text-rust">{formatFullDate(item.date).split(' ').slice(0, 2).join(' ')}</p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-ink">{item.label}</p>
                <p className="truncate text-[10.5px] text-ink-muted">{item.detail}</p>
              </div>
              <span className={cn('shrink-0 font-mono-figure text-xs font-semibold', item.kind === 'udhaar' ? 'text-success' : 'text-ink')}>
                {formatCurrency(item.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
