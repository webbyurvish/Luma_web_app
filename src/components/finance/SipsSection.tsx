import { useState } from 'react'
import { PiggyBank, Plus } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { ListSkeleton, StatTileSkeleton } from '@/components/ui/Skeleton'
import { SlowLoadHint, SyncBadge, SyncBar } from '@/components/ui/Loader'
import { getErrorMessage } from '@/lib/errors'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { SipRow } from './SipRow'
import { SipEditor } from './SipEditor'
import { SipContributionBars } from './SipContributionBars'
import { UpcomingSipsList } from './UpcomingSipsList'
import { useSips } from '@/hooks/useFinanceCollections'
import { useToast } from '@/context/ToastContext'
import { formatCurrency } from '@/lib/formatCurrency'
import { todayIstDateKey } from '@/lib/formatDate'
import { getActiveSipCount, getMonthlySipTotal, getSipsByFund, getSipsByPlatform, getUpcomingSips } from '@/lib/financeCalculations'
import type { FinancialAccount, SIP, SIPInput } from '@/types'

interface SipsSectionProps {
  accounts: FinancialAccount[]
}

export function SipsSection({ accounts }: SipsSectionProps) {
  const { sips, loading, refreshing, error, refetch, createSip, creating, updateSip, updating, deactivateSip, deactivating } = useSips()
  const { showToast } = useToast()

  const [editorTarget, setEditorTarget] = useState<SIP | 'new' | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<SIP | null>(null)

  const monthlyTotal = getMonthlySipTotal(sips)
  const activeCount = getActiveSipCount(sips)
  const byFund = getSipsByFund(sips)
  const byPlatform = getSipsByPlatform(sips, accounts)
  const upcoming = getUpcomingSips(sips, todayIstDateKey(), 5)

  const activeSips = sips.filter((s) => s.isActive)
  const pausedSips = sips.filter((s) => !s.isActive)
  const platformFor = (id?: string) => accounts.find((a) => a.id === id)

  const handleSave = async (input: SIPInput) => {
    try {
      if (editorTarget && editorTarget !== 'new') {
        await updateSip(editorTarget.id, input)
        showToast('SIP updated')
      } else {
        await createSip(input)
        showToast('SIP added')
      }
      setEditorTarget(null)
    } catch (err) {
      showToast(getErrorMessage(err, "Couldn't save the SIP. Please try again."), 'error')
    }
  }

  const handleDeactivateConfirm = async () => {
    if (!deactivateTarget) return
    try {
      await deactivateSip(deactivateTarget.id)
      showToast('SIP deactivated')
      setDeactivateTarget(null)
    } catch (err) {
      showToast(getErrorMessage(err, "Couldn't deactivate the SIP. Please try again."), 'error')
    }
  }

  if (error) {
    return <ErrorState title="Couldn't load your SIPs." description={error} onRetry={refetch} />
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatTileSkeleton />
          <StatTileSkeleton />
          <StatTileSkeleton />
        </div>
        <Card variant="panel">
          <ListSkeleton rows={4} />
          <SlowLoadHint />
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Card variant="panel" className="relative">
        <SyncBar active={refreshing} />
        <div className="absolute -top-2.5 right-5 z-10">
          <SyncBadge active={refreshing} />
        </div>
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
                  <SipRow key={sip.id} sip={sip} platform={platformFor(sip.platformAccountId)} onEdit={setEditorTarget} onDeactivate={setDeactivateTarget} />
                ))}
              </div>
            )}
            {pausedSips.length > 0 && (
              <div className="mt-4 border-t border-border-soft pt-4">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Paused</p>
                <div className="divide-y divide-border-soft">
                  {pausedSips.map((sip) => (
                    <SipRow key={sip.id} sip={sip} platform={platformFor(sip.platformAccountId)} onEdit={setEditorTarget} onDeactivate={setDeactivateTarget} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      <SipEditor
        open={editorTarget !== null}
        sip={editorTarget === 'new' ? null : editorTarget}
        accounts={accounts}
        onClose={() => setEditorTarget(null)}
        onSave={handleSave}
        saving={creating || updating}
      />

      <ConfirmDialog
        open={deactivateTarget !== null}
        title="Deactivate SIP?"
        description={`"${deactivateTarget?.fundName}" will stop counting toward your monthly SIP total and move to Paused. Its history is kept.`}
        confirmLabel="Deactivate"
        loading={deactivating}
        loadingLabel="Deactivating…"
        onConfirm={handleDeactivateConfirm}
        onCancel={() => setDeactivateTarget(null)}
      />
    </div>
  )
}
