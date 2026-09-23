import { useMemo, useState } from 'react'
import { Landmark, Plus } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { ChartCardSkeleton } from '@/components/ui/Skeleton'
import { AccountRow } from './AccountRow'
import { AccountEditor } from './AccountEditor'
import type { UseAccountsResult } from '@/hooks/useFinanceCollections'
import { useToast } from '@/context/ToastContext'
import { ACCOUNT_TYPE_META } from '@/lib/accountMeta'
import { formatCurrency } from '@/lib/formatCurrency'
import type { AccountInput, AccountType } from '@/types'

const GROUP_ORDER: AccountType[] = ['bank', 'cash', 'wallet', 'credit_card', 'demat', 'other']

interface AccountsSectionProps {
  /** Owned by the Finance page so Accounts/Investments/SIPs tabs share one fetch instead of each calling useAccounts(). */
  accountsState: UseAccountsResult
}

export function AccountsSection({ accountsState }: AccountsSectionProps) {
  const { accounts, loading, error, refetch, createAccount, creating } = accountsState
  const { showToast } = useToast()

  const [editorOpen, setEditorOpen] = useState(false)

  const groups = useMemo(() => {
    return GROUP_ORDER.map((type) => {
      const items = accounts.filter((a) => a.type === type && a.isActive)
      const subtotal = items.reduce((sum, a) => sum + a.balance, 0)
      return { type, items, subtotal }
    }).filter((g) => g.items.length > 0)
  }, [accounts])

  const totalAssets = accounts.filter((a) => a.isActive && a.type !== 'credit_card').reduce((sum, a) => sum + a.balance, 0)

  const handleSave = async (input: AccountInput) => {
    await createAccount(input)
    showToast('Account added')
    setEditorOpen(false)
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
        <ChartCardSkeleton />
      </Card>
    )
  }

  return (
    <Card variant="panel">
      <CardHeader
        title="Your Accounts"
        subtitle={`${accounts.filter((a) => a.isActive).length} accounts · ${formatCurrency(totalAssets, { compact: true })} in assets`}
        action={
          <Button size="sm" icon={<Plus size={13} />} onClick={() => setEditorOpen(true)}>
            Add Account
          </Button>
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
                    <AccountRow key={account.id} account={account} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <AccountEditor open={editorOpen} onClose={() => setEditorOpen(false)} onSave={handleSave} saving={creating} />
    </Card>
  )
}
