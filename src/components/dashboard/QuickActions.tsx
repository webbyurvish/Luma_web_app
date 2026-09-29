import { useState } from 'react'
import { ArrowLeftRight, CircleMinus, CirclePlus, FilePlus2, HandCoins, ListChecks } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { QuickActionModal, type QuickActionKind } from '@/components/common/QuickActionModal'
import { cn } from '@/lib/cn'

interface QuickActionDef {
  kind: QuickActionKind
  label: string
  icon: typeof CirclePlus
  color: string
}

const actions: QuickActionDef[] = [
  { kind: 'expense', label: 'Add expense', icon: CircleMinus, color: 'text-danger' },
  { kind: 'income', label: 'Add income', icon: CirclePlus, color: 'text-success' },
  { kind: 'udhaar', label: 'Add udhaar', icon: HandCoins, color: 'text-ai' },
  { kind: 'repayment', label: 'Add repayment', icon: ArrowLeftRight, color: 'text-pink' },
  { kind: 'task', label: 'Add task', icon: ListChecks, color: 'text-ink-soft' },
  { kind: 'document', label: 'Add document', icon: FilePlus2, color: 'text-cyan' },
]

export function QuickActions() {
  const [activeKind, setActiveKind] = useState<QuickActionKind | null>(null)

  return (
    <Card hoverable>
      <CardHeader title="Quick actions" subtitle="Add something in seconds" />
      <ul className="-mx-1 divide-y divide-border-soft">
        {actions.map((action) => (
          <li key={action.kind}>
            <button
              onClick={() => setActiveKind(action.kind)}
              className={cn(
                'group flex w-full items-center gap-2.5 px-1 py-2 text-left text-xs text-ink-soft transition-colors hover:text-ink',
              )}
            >
              <action.icon size={14} className={cn('shrink-0 transition-transform duration-150 group-hover:translate-x-0.5', action.color)} />
              <span className="flex-1">{action.label}</span>
              <span className="text-ink-muted opacity-0 transition-opacity group-hover:opacity-100">→</span>
            </button>
          </li>
        ))}
      </ul>

      <QuickActionModal open={activeKind !== null} kind={activeKind ?? 'expense'} onClose={() => setActiveKind(null)} />
    </Card>
  )
}
