import { useState } from 'react'
import { PiggyBank, Plus } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { SipRow } from './SipRow'
import { SipEditor } from './SipEditor'
import { SipContributionBars } from './SipContributionBars'
import { UpcomingSipsList } from './UpcomingSipsList'
import { useAccounts, useSips } from '@/hooks/useFinanceCollections'
import { useToast } from '@/context/ToastContext'
import { formatCurrency } from '@/lib/formatCurrency'
import { getActiveSipCount, getMonthlySipTotal, getSipsByFund, getSipsByPlatform, getUpcomingSips } from '@/lib/financeCalculations'
import type { SIP, SIPInput } from '@/types'

const TODAY = '2026-09-22'

export function SipsSection() {
  const { sips, createSip, updateSip, deleteSip } = useSips()
  const { accounts } = useAccounts()
  const { showToast } = useToast()

  const [editorTarget, setEditorTarget] = useState<SIP | 'new' | null>(null)
  const [deletingSip, setDeletingSip] = useState<SIP | null>(null)

  const monthlyTotal = getMonthlySipTotal(sips)
  const activeCount = getActiveSipCount(sips)
  const byFund = getSipsByFund(sips)
  const byPlatform = getSipsByPlatform(sips, accounts)
  const upcoming = getUpcomingSips(sips, TODAY, 5)

  const activeSips = sips.filter((s) => s.isActive)
  const pausedSips = sips.filter((s) => !s.isActive)
  const platformFor = (id?: string) => accounts.find((a) => a.id === id)

  const handleSave = (input: SIPInput) => {
    if (editorTarget && editorTarget !== 'new') {
      updateSip(editorTarget.id, input)
      showToast('SIP updated')
    } else {
      createSip(input)
      showToast('SIP added')
    }
    setEditorTarget(null)
  }

  const handleConfirmDelete = () => {
    if (!deletingSip) return
    deleteSip(deletingSip.id)
    showToast('SIP deleted')
    setDeletingSip(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <Card variant="panel">
        <div className="grid grid-cols-2 divide-x divide-border-soft sm:grid-cols-3">
          <div className="pr-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Monthly SIP</p>
            <p className="mt-1.5 font-mono-figure text-2xl font-bold text-ink">{formatCurrency(monthlyTotal)}</p>
          </div>
          <div className="px-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Active SIPs</p>
            <p className="mt-1.5 font-mono-figure text-2xl font-bold text-ink">{activeCount}</p>
          </div>
          <div className="col-span-2 px-4 sm:col-span-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Annual Commitment</p>
            <p className="mt-1.5 font-mono-figure text-2xl font-bold text-ink">{formatCurrency(monthlyTotal * 12, { compact: true })}</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SipContributionBars title="SIP by Fund" subtitle="Monthly contribution" groups={byFund} />
        <UpcomingSipsList upcoming={upcoming} accounts={accounts} />
      </div>

      {byPlatform.length > 1 && <SipContributionBars title="SIP by Platform" subtitle="Monthly contribution" groups={byPlatform} />}

      <Card variant="panel">
        <CardHeader
          title="Your SIPs"
          subtitle={`${sips.length} total · ${activeCount} active`}
          action={
            <Button size="sm" icon={<Plus size={13} />} onClick={() => setEditorTarget('new')}>
              Add SIP
            </Button>
          }
        />

        {sips.length === 0 ? (
          <EmptyState icon={<PiggyBank size={22} />} title="No SIPs yet" description="Add your first recurring investment to track it here." />
        ) : (
          <>
            {activeSips.length > 0 && (
              <div className="divide-y divide-border-soft">
                {activeSips.map((sip) => (
                  <SipRow key={sip.id} sip={sip} platform={platformFor(sip.platformAccountId)} onEdit={setEditorTarget} onDelete={setDeletingSip} />
                ))}
              </div>
            )}
            {pausedSips.length > 0 && (
              <div className="mt-4 border-t border-border-soft pt-4">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Paused</p>
                <div className="divide-y divide-border-soft">
                  {pausedSips.map((sip) => (
                    <SipRow key={sip.id} sip={sip} platform={platformFor(sip.platformAccountId)} onEdit={setEditorTarget} onDelete={setDeletingSip} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      <SipEditor
        open={editorTarget !== null}
        sip={editorTarget && editorTarget !== 'new' ? editorTarget : null}
        accounts={accounts}
        onClose={() => setEditorTarget(null)}
        onSave={handleSave}
      />

      <ConfirmDialog
        open={deletingSip !== null}
        title="Delete this SIP?"
        description="Consider pausing it instead if you just want to stop new debits while keeping its history. This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingSip(null)}
      />
    </div>
  )
}
