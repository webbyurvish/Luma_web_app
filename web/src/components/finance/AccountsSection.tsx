import { useMemo, useState } from 'react'
import { Landmark, Plus } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { ListSkeleton } from '@/components/ui/Skeleton'
import { SlowLoadHint, SyncBadge, SyncBar } from '@/components/ui/Loader'
import { getErrorMessage } from '@/lib/errors'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DeleteRecordDialog } from '@/components/ui/DeleteRecordDialog'
import { useInvestments, useSips } from '@/hooks/useFinanceCollections'
import { useTransactions } from '@/hooks/useTransactions'
import { useUdhaar } from '@/hooks/useLifeCollections'
import { AccountActivityPanel } from './AccountActivityPanel'
import { AccountRow } from './AccountRow'
import { AccountEditor } from './AccountEditor'
import type { UseAccountsResult } from '@/hooks/useFinanceCollections'
import { useToast } from '@/context/ToastContext'
import { ACCOUNT_TYPE_META } from '@/lib/accountMeta'
import { formatCurrency } from '@/lib/formatCurrency'
import type { AccountInput, AccountType, FinancialAccount } from '@/types'

const GROUP_ORDER: AccountType[] = ['bank', 'cash', 'wallet', 'credit_card', 'demat', 'other']

interface AccountsSectionProps {
  /** Owned by the Finance page so Accounts/Investments/SIPs tabs share one fetch instead of each calling useAccounts(). */
  accountsState: UseAccountsResult
}

export function AccountsSection({ accountsState }: AccountsSectionProps) {
  const { accounts, loading, refreshing, error, refetch, createAccount, creating, updateAccount, updating, archiveAccount, archiving, deleteAccount, deleting } = accountsState
  const { showToast } = useToast()

  const [editorTarget, setEditorTarget] = useState<FinancialAccount | 'new' | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<FinancialAccount | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<FinancialAccount | null>(null)
  const [activityTarget, setActivityTarget] = useState<FinancialAccount | null>(null)
  const { transactions } = useTransactions()
  const { entries: udhaarEntries } = useUdhaar()
  const accountNames = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts])
  // Shared store: these reuse the Investments/SIPs tabs' data, no extra requests.
  const { investments } = useInvestments()
  const { sips } = useSips()

  const groups = useMemo(() => {
    return GROUP_ORDER.map((type) => {
      const items = accounts.filter((a) => a.type === type && a.isActive)
      const subtotal = items.reduce((sum, a) => sum + a.balance, 0)
      return { type, items, subtotal }
    }).filter((g) => g.items.length > 0)
  }, [accounts])

  const totalAssets = accounts.filter((a) => a.isActive && a.type !== 'credit_card').reduce((sum, a) => sum + a.balance, 0)

  const handleSave = async (input: AccountInput) => {
    try {
      if (editorTarget && editorTarget !== 'new') {
        await updateAccount(editorTarget.id, input)
        showToast('Account updated')
      } else {
        await createAccount(input)
        showToast('Account added')
      }
      setEditorTarget(null)
    } catch (err) {
      showToast(getErrorMessage(err, "Couldn't save the account. Please try again."), 'error')
    }
  }

  const handleArchiveConfirm = async () => {
    if (!archiveTarget) return
    try {
      await archiveAccount(archiveTarget.id)
      showToast('Account archived')
      setArchiveTarget(null)
    } catch (err) {
      showToast(getErrorMessage(err, "Couldn't archive the account. Please try again."), 'error')
    }
  }

  // Checked up front from data already on screen; the backend re-checks (incl. transactions/udhaar).
  const deleteBlockedReason = useMemo(() => {
    if (!deleteTarget) return null
    const linked = [
      [investments.filter((i) => i.platformAccountId === deleteTarget.id).length, 'investment'],
      [sips.filter((s) => s.isActive && s.platformAccountId === deleteTarget.id).length, 'active SIP'],
    ] as const
    const parts = linked.filter(([count]) => count > 0).map(([count, label]) => `${count} ${label}${count > 1 ? 's' : ''}`)
    return parts.length
      ? `"${deleteTarget.name}" is still linked to ${parts.join(' and ')}. Delete or archive those first, or archive this account instead.`
      : null
  }, [deleteTarget, investments, sips])

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    try {
      await deleteAccount(deleteTarget.id)
      showToast('Account deleted')
      setDeleteTarget(null)
    } catch (err) {
      showToast(getErrorMessage(err, "Couldn't delete the account. Please try again."), 'error')
    }
  }

  if (error) {
    return (
      <Card variant="panel">
        <CardHeader title="Your Accounts" subtitle="Everything you own, in one place" />
        <ErrorState title="Couldn't load your accounts." description={error} onRetry={refetch} />
      </Card>
    )
  }

  if (loading) {
    return (
      <Card variant="panel">
        <CardHeader title="Your Accounts" subtitle="Everything you own, in one place" />
        <ListSkeleton rows={4} />
        <SlowLoadHint />
      </Card>
    )
  }

  return (
    <Card variant="panel" className="relative">
      <SyncBar active={refreshing} />
      <CardHeader
        title="Your Accounts"
        subtitle={`${accounts.filter((a) => a.isActive).length} accounts · ${formatCurrency(totalAssets, { compact: true })} in assets`}
        action={
          <div className="flex items-center gap-2">
            <SyncBadge active={refreshing} />
            <Button size="sm" icon={<Plus size={13} />} onClick={() => setEditorTarget('new')}>
              Add Account
            </Button>
          </div>
        }
      />

      {groups.length === 0 ? (
        <EmptyState icon={<Landmark size={22} />} title="No accounts yet" description="Add your first account to start mapping your money." />
      ) : (
        <div>
          {groups.map((group, index) => {
            const meta = ACCOUNT_TYPE_META[group.type]
            return (
              <div key={group.type} className={index > 0 ? 'mt-4 border-t border-border-soft pt-4' : ''}>
                <div className="mb-1 flex items-baseline justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                    {meta.pluralLabel} · {group.items.length}
                  </p>
                  <p className="font-mono-figure text-xs text-ink-soft">{formatCurrency(group.subtotal, { compact: true })}</p>
                </div>
                <div className="divide-y divide-border-soft">
                  {group.items.map((account) => (
                    <AccountRow key={account.id} account={account} onEdit={setEditorTarget} onArchive={setArchiveTarget} onDelete={setDeleteTarget} onOpen={setActivityTarget} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <AccountEditor
        open={editorTarget !== null}
        account={editorTarget === 'new' ? null : editorTarget}
        onClose={() => setEditorTarget(null)}
        onSave={handleSave}
        saving={creating || updating}
      />

      <ConfirmDialog
        open={archiveTarget !== null}
        title="Archive account?"
        description={`"${archiveTarget?.name}" will be hidden from your accounts and totals. Historical transactions that reference it are kept exactly as they are.`}
        confirmLabel="Archive"
        loading={archiving}
        loadingLabel="Archiving…"
        onConfirm={handleArchiveConfirm}
        onCancel={() => setArchiveTarget(null)}
      />

      <AccountActivityPanel
        account={activityTarget ? (accounts.find((a) => a.id === activityTarget.id) ?? activityTarget) : null}
        transactions={transactions}
        udhaar={udhaarEntries}
        accountNames={accountNames}
        onClose={() => setActivityTarget(null)}
        onEdit={(a) => {
          setActivityTarget(null)
          setEditorTarget(a)
        }}
      />

      <DeleteRecordDialog
        open={deleteTarget !== null}
        recordType="account"
        recordName={deleteTarget?.name}
        blockedReason={deleteBlockedReason}
        softActionLabel="Archive"
        loading={deleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </Card>
  )
}
