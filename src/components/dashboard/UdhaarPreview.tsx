import { Link } from 'react-router-dom'
import { HandCoins } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Badge, type BadgeVariant } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency } from '@/lib/formatCurrency'
import { mockUdhaarPeople, mockUdhaarSummary } from '@/data/mockUdhaar'
import type { UdhaarStatus } from '@/types'

const statusConfig: Record<UdhaarStatus, { label: string; variant: BadgeVariant }> = {
  'due-soon': { label: 'Due Soon', variant: 'warning' },
  overdue: { label: 'Overdue', variant: 'danger' },
  pending: { label: 'Pending', variant: 'info' },
  settled: { label: 'Settled', variant: 'success' },
}

export function UdhaarPreview() {
  const people = mockUdhaarPeople.filter((person) => person.outstanding > 0).slice(0, 4)

  return (
    <Card hoverable variant="tint" className="bg-gradient-lavender h-full">
      <CardHeader
        title="Money to receive"
        subtitle="People who owe you"
        action={
          <Link to="/udhaar" className="text-xs font-medium text-ai hover:underline">
            View all
          </Link>
        }
      />

      <div className="mb-4 flex items-end justify-between rounded-btn bg-white/55 px-3.5 py-3">
        <div>
          <p className="text-[11px] font-medium text-ink-soft">Total to receive</p>
          <p className="mt-0.5 text-xl font-bold tracking-tight text-ink">{formatCurrency(mockUdhaarSummary.toReceive)}</p>
        </div>
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ai text-white">
          <HandCoins size={16} />
        </span>
      </div>

      {people.length === 0 ? (
        <EmptyState icon={<HandCoins size={20} />} title="All settled up" description="No pending udhaar right now." />
      ) : (
        <ul className="space-y-3.5">
          {people.map((person) => {
            const status = statusConfig[person.status]
            return (
              <li key={person.id} className="flex items-center gap-3">
                <Avatar name={person.name} size={34} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{person.name}</p>
                  <Badge variant={status.variant} className="mt-1">
                    {status.label}
                  </Badge>
                </div>
                <p className="shrink-0 text-sm font-semibold text-ink">{formatCurrency(person.outstanding)}</p>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
