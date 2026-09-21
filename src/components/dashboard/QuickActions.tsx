import { useState } from 'react'
import { ArrowLeftRight, CircleMinus, CirclePlus, HandCoins, ListChecks, Upload } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { QuickActionModal, type QuickActionKind } from '@/components/common/QuickActionModal'

interface QuickActionDef {
  kind: QuickActionKind
  label: string
  icon: typeof CirclePlus
  bg: string
  color: string
}

const actions: QuickActionDef[] = [
  { kind: 'expense', label: 'Add Expense', icon: CircleMinus, bg: 'bg-danger-soft', color: 'text-danger' },
  { kind: 'income', label: 'Add Income', icon: CirclePlus, bg: 'bg-success-soft', color: 'text-success' },
  { kind: 'udhaar', label: 'Add Udhaar', icon: HandCoins, bg: 'bg-ai-soft', color: 'text-ai' },
  { kind: 'repayment', label: 'Add Repayment', icon: ArrowLeftRight, bg: 'bg-pink-soft', color: 'text-pink' },
  { kind: 'task', label: 'Add Task', icon: ListChecks, bg: 'bg-info-soft', color: 'text-info' },
  { kind: 'document', label: 'Upload Doc', icon: Upload, bg: 'bg-cyan-soft', color: 'text-cyan' },
]

export function QuickActions() {
  const [activeKind, setActiveKind] = useState<QuickActionKind | null>(null)

  return (
    <Card className="h-full">
      <CardHeader title="Quick Actions" subtitle="Add something in seconds" />
      <div className="grid grid-cols-3 gap-3">
        {actions.map((action) => (
          <button
            key={action.kind}
            onClick={() => setActiveKind(action.kind)}
            className="group flex flex-col items-center gap-2 rounded-btn px-2 py-3 text-center transition-transform duration-200 hover:-translate-y-0.5"
          >
            <span className={`flex h-11 w-11 items-center justify-center rounded-full ${action.bg} ${action.color} transition-shadow duration-200 group-hover:shadow-hover`}>
              <action.icon size={19} />
            </span>
            <span className="text-[11px] font-medium leading-tight text-ink-soft group-hover:text-ink">{action.label}</span>
          </button>
        ))}
      </div>

      <QuickActionModal open={activeKind !== null} kind={activeKind ?? 'expense'} onClose={() => setActiveKind(null)} />
    </Card>
  )
}
