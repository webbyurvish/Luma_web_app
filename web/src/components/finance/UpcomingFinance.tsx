import { CalendarClock } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { UpcomingRowSkeleton } from '@/components/ui/Skeleton'
import { formatCurrency } from '@/lib/formatCurrency'
import { formatFullDate, todayIstDateKey } from '@/lib/formatDate'
import { getUpcomingSips } from '@/lib/financeCalculations'
import { useUdhaar } from '@/hooks/useLifeCollections'
import { useAccounts, useSips } from '@/hooks/useFinanceCollections'
import { cn } from '@/lib/cn'
import { useBills } from '@/hooks/usePlanning'
import { billStatus, dueLabel } from '@/lib/planning'

interface UpcomingItem {
  date: string
  label: string
  detail: string
  amount: number
  kind: 'sip' | 'udhaar' | 'bill'
  overdue?: boolean
}

export function UpcomingFinance() {
  const { sips, loading: sipsLoading, error: sipsError, refetch: refetchSips } = useSips()
  const { accounts, loading: accountsLoading, error: accountsError, refetch: refetchAccounts } = useAccounts()
  const { people: udhaarPeople, loading: udhaarLoading } = useUdhaar()
  // Bills are optional here: an older script without them just leaves them out.
  const { bills } = useBills()

  const loading = sipsLoading || accountsLoading || udhaarLoading
  const error = sipsError ?? accountsError
  const retry = () => {
    refetchSips()
    refetchAccounts()
  }

  const platformName = (id?: string) => accounts.find((a) => a.id === id)?.name ?? 'Unassigned'
  const today = todayIstDateKey()

  const sipItems: UpcomingItem[] = getUpcomingSips(sips, today, 3).map(({ sip, nextDate }) => ({
    date: nextDate,
    label: sip.fundName,
    detail: `${platformName(sip.platformAccountId)} SIP`,
    amount: sip.amount,
    kind: 'sip',
  }))

  const udhaarItems: UpcomingItem[] = udhaarPeople
    .filter((p): p is typeof p & { dueDate: string } => p.outstanding > 0 && !!p.dueDate && p.dueDate >= today)
    .map((p) => ({ date: p.dueDate, label: p.name, detail: 'Udhaar due', amount: p.outstanding, kind: 'udhaar' }))

  const billItems: UpcomingItem[] = bills
    .map((bill) => ({ bill, ...billStatus(bill, today) }))
    .filter((b) => b.state !== 'paused' && b.days <= 31)
    .map(({ bill, state, days }) => ({
      date: bill.nextDueDate,
      label: bill.name,
      detail: state === 'overdue' ? dueLabel(days) : `${bill.frequency} bill`,
      amount: bill.amount,
      kind: 'bill',
      overdue: state === 'overdue',
    }))

  const items = [...sipItems, ...udhaarItems, ...billItems].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(0, 6)

  return (
    <Card hoverable className="h-full">
      <CardHeader title="Upcoming" subtitle="Bills, SIPs and money due" />
      {error ? (
        <ErrorState title="Couldn't load upcoming items." description={error} onRetry={retry} />
      ) : loading ? (
        <div className="-mx-1.5 divide-y divide-border-soft">
          {[0, 1, 2, 3].map((i) => (
            <UpcomingRowSkeleton key={i} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={<CalendarClock size={20} />} title="Nothing upcoming" description="Scheduled SIPs and dues will show up here." />
      ) : (
        <ul className="-mx-1.5 divide-y divide-border-soft">
          {items.map((item, index) => (
            <li key={`${item.kind}-${index}`} className="flex items-center gap-3 px-1.5 py-2.5">
              <div className="w-14 shrink-0">
                <p className={cn('font-mono-figure text-xs font-bold', item.overdue ? 'text-danger' : 'text-rust')}>{formatFullDate(item.date).split(' ').slice(0, 2).join(' ')}</p>
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
