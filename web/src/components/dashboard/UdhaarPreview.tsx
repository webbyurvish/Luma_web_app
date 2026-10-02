import { Link } from 'react-router-dom'
import { HandCoins } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Badge, type BadgeVariant } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency } from '@/lib/formatCurrency'
import { formatDate } from '@/lib/formatDate'
import { useUdhaar } from '@/hooks/useLifeCollections'
import { ListRowSkeleton } from '@/components/ui/Skeleton'
import type { UdhaarStatus } from '@/types'

const statusConfig: Record<UdhaarStatus, { label: string; variant: BadgeVariant }> = {
  'due-soon': { label: 'Due soon', variant: 'warning' },
  overdue: { label: 'Overdue', variant: 'danger' },
  pending: { label: 'Pending', variant: 'info' },
  settled: { label: 'Settled', variant: 'success' },
}

export function UdhaarPreview() {
  const { people: allPeople, loading } = useUdhaar()
  const people = allPeople.filter((person) => person.outstanding > 0).slice(0, 4)

  return (
    <Card hoverable className="h-full">
      <CardHeader
        title="Money to receive"
        subtitle="People who owe you"
        action={
          <Link to="/udhaar" className="-mx-2 -my-2.5 inline-flex px-2 py-2.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-rust hover:underline">
            View all
          </Link>
        }
      />

      {loading ? (
        <div className="divide-y divide-border-soft">
          {[0, 1, 2].map((i) => (
            <ListRowSkeleton key={i} />
          ))}
        </div>
      ) : people.length === 0 ? (
        <EmptyState icon={<HandCoins size={20} />} title="All settled up" description="No pending udhaar right now." />
      ) : (
        <ul className="divide-y divide-border-soft">
          {people.map((person) => {
            const status = statusConfig[person.status]
            return (
              <li key={person.id} className="group flex items-center gap-2.5 rounded-xs px-1 py-2 transition-colors hover:bg-bg-soft">
                <Avatar name={person.name} size={26} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-ink">{person.name}</p>
                  <div className="mt-0.5 opacity-100 transition-opacity group-hover:opacity-0">
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono-figure text-xs font-bold text-ink">{formatCurrency(person.outstanding)}</p>
                  <p className="hidden text-[9px] font-mono-figure text-ink-muted group-hover:block">{person.dueDate ? `Due ${formatDate(person.dueDate)}` : "No due date"}</p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
