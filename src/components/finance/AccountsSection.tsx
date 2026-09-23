import { useMemo, useState } from 'react'
import { Landmark, Plus } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { AccountRow } from './AccountRow'
import { AccountEditor } from './AccountEditor'
import { useAccounts } from '@/hooks/useFinanceCollections'
import { useToast } from '@/context/ToastContext'
import { ACCOUNT_TYPE_META } from '@/lib/accountMeta'
import { formatCurrency } from '@/lib/formatCurrency'
import type { AccountInput, AccountType, FinancialAccount } from '@/types'

const GROUP_ORDER: AccountType[] = ['bank', 'cash', 'wallet', 'credit_card', 'demat', 'other']

export function AccountsSection() {
  const { accounts, createAccount, updateAccount, deleteAccount } = useAccounts()
  const { showToast } = useToast()

  const [editorTarget, setEditorTarget] = useState<FinancialAccount | 'new' | null>(null)
  const [deletingAccount, setDeletingAccount] = useState<FinancialAccount | null>(null)

  const groups = useMemo(() => {
    return GROUP_ORDER.map((type) => {
      const items = accounts.filter((a) => a.type === type && a.isActive)
      const subtotal = items.reduce((sum, a) => sum + a.balance, 0)
      return { type, items, subtotal }
    }).filter((g) => g.items.length > 0)
  }, [accounts])

  const totalAssets = accounts
    .filter((a) => a.isActive && a.type !== 'credit_card')
    .reduce((sum, a) => sum + a.balance, 0)

  const handleSave = (input: AccountInput) => {
    if (editorTarget && editorTarget !== 'new') {
      updateAccount(editorTarget.id, input)
      showToast('Account updated')
    } else {
      createAccount(input)
      showToast('Account added')
    }
    setEditorTarget(null)
  }

  const handleConfirmDelete = () => {
    if (!deletingAccount) return
    deleteAccount(deletingAccount.id)
    showToast('Account deleted')
    setDeletingAccount(null)
  }

  return (
    <Card variant="panel">
      <CardHeader
        title="Your Accounts"
        subtitle={`${accounts.filter((a) => a.isActive).length} accounts · ${formatCurrency(totalAssets, { compact: true })} in assets`}
        action={
          <Button size="sm" icon={<Plus size={13} />} onClick={() => setEditorTarget('new')}>
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
                    <AccountRow key={account.id} account={account} onEdit={(a) => setEditorTarget(a)} onDelete={setDeletingAccount} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <AccountEditor
        open={editorTarget !== null}
        account={editorTarget && editorTarget !== 'new' ? editorTarget : null}
        onClose={() => setEditorTarget(null)}
        onSave={handleSave}
      />

      <ConfirmDialog
        open={deletingAccount !== null}
        title="Delete this account?"
        description="This action cannot be undone. Any investments or SIPs linked to this account will keep their history but lose the platform reference."
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingAccount(null)}
      />
    </Card>
  )
}
