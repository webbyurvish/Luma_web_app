import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeftRight, CircleMinus, CirclePlus, HandCoins, ListChecks, Upload } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { QuickActionModal, type QuickActionKind } from '@/components/common/QuickActionModal'
import { tileHover } from '@/lib/motion'

interface QuickActionDef {
  kind: QuickActionKind
  label: string
  icon: typeof CirclePlus
  tint: string
  color: string
}

const actions: QuickActionDef[] = [
  { kind: 'expense', label: 'Expense', icon: CircleMinus, tint: 'bg-danger-soft', color: 'text-danger' },
  { kind: 'income', label: 'Income', icon: CirclePlus, tint: 'bg-success-soft', color: 'text-success' },
  { kind: 'udhaar', label: 'Udhaar', icon: HandCoins, tint: 'bg-ai-soft', color: 'text-ai' },
  { kind: 'repayment', label: 'Repayment', icon: ArrowLeftRight, tint: 'bg-pink-soft', color: 'text-pink' },
  { kind: 'task', label: 'Task', icon: ListChecks, tint: 'bg-info-soft', color: 'text-info' },
  { kind: 'document', label: 'Upload', icon: Upload, tint: 'bg-cyan-soft', color: 'text-cyan' },
]

export function QuickActions() {
  const [activeKind, setActiveKind] = useState<QuickActionKind | null>(null)

  return (
    <Card hoverable className="h-full">
      <CardHeader title="Quick Actions" subtitle="Add something in seconds" />
      <div className="grid grid-cols-3 gap-2.5">
        {actions.map((action) => (
          <motion.button
            key={action.kind}
            onClick={() => setActiveKind(action.kind)}
            initial="rest"
            whileHover="hover"
            whileTap="tap"
            variants={tileHover}
            className={`flex flex-col items-center gap-2 rounded-btn ${action.tint} px-2 py-3.5 text-center`}
          >
            <motion.span
              variants={{ rest: { y: 0 }, hover: { y: -2 } }}
              transition={{ duration: 0.2 }}
              className={`flex h-10 w-10 items-center justify-center rounded-full bg-white/70 ${action.color}`}
            >
              <action.icon size={18} />
            </motion.span>
            <span className="text-[11px] font-medium leading-tight text-ink">{action.label}</span>
          </motion.button>
        ))}
      </div>

      <QuickActionModal open={activeKind !== null} kind={activeKind ?? 'expense'} onClose={() => setActiveKind(null)} />
    </Card>
  )
}
