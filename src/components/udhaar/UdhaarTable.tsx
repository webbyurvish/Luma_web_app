import { HandCoins } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Badge, type BadgeVariant } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency } from '@/lib/formatCurrency'
import { formatDate } from '@/lib/formatDate'
import { mockUdhaarPeople } from '@/data/mockUdhaar'
import type { UdhaarStatus } from '@/types'

const statusConfig: Record<UdhaarStatus, { label: string; variant: BadgeVariant }> = {
  'due-soon': { label: 'Due soon', variant: 'warning' },
  overdue: { label: 'Overdue', variant: 'danger' },
  pending: { label: 'Pending', variant: 'info' },
  settled: { label: 'Settled', variant: 'success' },
}

export function UdhaarTable() {
  return (
    <Card hoverable>
      <CardHeader title="Who owes me" subtitle="Everyone you've given money to" />
      {mockUdhaarPeople.length === 0 ? (
        <EmptyState icon={<HandCoins size={20} />} title="No udhaar yet" description="Amounts you give will show up here." />
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
              <th className="py-2 pr-3 font-semibold">Person</th>
              <th className="py-2 pr-3 text-right font-semibold">Given</th>
              <th className="py-2 pr-3 text-right font-semibold">Repaid</th>
              <th className="py-2 pr-3 text-right font-semibold">Outstanding</th>
              <th className="py-2 pr-3 font-semibold">Due date</th>
              <th className="py-2 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-soft">
            {mockUdhaarPeople.map((person) => {
              const status = statusConfig[person.status]
              return (
                <tr key={person.id} className="transition-colors hover:bg-bg-soft">
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={person.name} size={26} />
                      <span className="text-xs font-medium text-ink">{person.name}</span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 text-right font-mono-figure text-xs text-ink-soft">{formatCurrency(person.given)}</td>
                  <td className="py-2.5 pr-3 text-right font-mono-figure text-xs text-ink-soft">{formatCurrency(person.repaid)}</td>
                  <td className="py-2.5 pr-3 text-right font-mono-figure text-xs font-bold text-ink">{formatCurrency(person.outstanding)}</td>
                  <td className="py-2.5 pr-3 font-mono-figure text-xs text-ink-muted">{formatDate(person.dueDate)}</td>
                  <td className="py-2.5">
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </Card>
  )
}
