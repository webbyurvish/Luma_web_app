import { useState } from 'react'
import { AlertTriangle, ArrowLeftRight, HandCoins, Undo2 } from 'lucide-react'
import { StatCard } from '@/components/ui/StatCard'
import { Button } from '@/components/ui/Button'
import { UdhaarTable } from '@/components/udhaar/UdhaarTable'
import { QuickActionModal, type QuickActionKind } from '@/components/common/QuickActionModal'
import { formatCurrency } from '@/lib/formatCurrency'
import { mockUdhaarSummary } from '@/data/mockUdhaar'

export function Udhaar() {
  const [modalKind, setModalKind] = useState<QuickActionKind | null>(null)

  return (
    <div className="flex flex-col gap-5 pt-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <Button variant="secondary" icon={<Undo2 size={15} />} onClick={() => setModalKind('repayment')}>
          Add Repayment
        </Button>
        <Button icon={<HandCoins size={15} />} onClick={() => setModalKind('udhaar')}>
          Add Udhaar
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Given" value={formatCurrency(mockUdhaarSummary.totalGiven)} icon={<HandCoins size={17} />} accent="gold" />
        <StatCard label="Total Repaid" value={formatCurrency(mockUdhaarSummary.totalRepaid)} icon={<Undo2 size={17} />} accent="success" />
        <StatCard label="To Receive" value={formatCurrency(mockUdhaarSummary.toReceive)} icon={<ArrowLeftRight size={17} />} accent="ai" />
        <StatCard label="Overdue" value={formatCurrency(mockUdhaarSummary.overdue)} icon={<AlertTriangle size={17} />} accent="danger" />
      </div>

      <UdhaarTable />

      <QuickActionModal open={modalKind !== null} kind={modalKind ?? 'udhaar'} onClose={() => setModalKind(null)} />
    </div>
  )
}
