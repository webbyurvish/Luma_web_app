import { HandCoins } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Badge, type BadgeVariant } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency } from '@/lib/formatCurrency'
import { formatFullDate } from '@/lib/formatDate'
import { mockUdhaarPeople } from '@/data/mockUdhaar'
import type { UdhaarStatus } from '@/types'

const statusConfig: Record<UdhaarStatus, { label: string; variant: BadgeVariant }> = {
  'due-soon': { label: 'Due Soon', variant: 'warning' },
  overdue: { label: 'Overdue', variant: 'danger' },
  pending: { label: 'Pending', variant: 'info' },
  settled: { label: 'Settled', variant: 'success' },
}

export function UdhaarTable() {
  return (
    <Card>
      <CardHeader title="Who owes me" subtitle="Everyone you've given money to" />
      {mockUdhaarPeople.length === 0 ? (
        <EmptyState icon={<HandCoins size={22} />} title="No udhaar yet" description="Amounts you give will show up here." />
      ) : (
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-left text-xs font-medium text-ink-soft">
                <th className="px-2 pb-3 font-medium">Person</th>
                <th className="px-2 pb-3 text-right font-medium">Given</th>
                <th className="px-2 pb-3 text-right font-medium">Repaid</th>
                <th className="px-2 pb-3 text-right font-medium">Outstanding</th>
                <th className="px-2 pb-3 font-medium">Due Date</th>
                <th className="px-2 pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {mockUdhaarPeople.map((person) => {
                const status = statusConfig[person.status]
                return (
                  <tr key={person.id} className="transition-colors hover:bg-bg-soft">
                    <td className="border-t border-border px-2 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={person.name} size={30} />
                        <span className="font-medium text-ink">{person.name}</span>
                      </div>
                    </td>
                    <td className="border-t border-border px-2 py-3.5 text-right text-ink-soft">{formatCurrency(person.given)}</td>
                    <td className="border-t border-border px-2 py-3.5 text-right text-ink-soft">{formatCurrency(person.repaid)}</td>
                    <td className="border-t border-border px-2 py-3.5 text-right font-semibold text-ink">
                      {formatCurrency(person.outstanding)}
                    </td>
                    <td className="border-t border-border px-2 py-3.5 text-ink-soft">{formatFullDate(person.dueDate)}</td>
                    <td className="border-t border-border px-2 py-3.5">
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
