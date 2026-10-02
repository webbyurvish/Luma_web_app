import { useEffect, useMemo, useState } from 'react'
import { ClipboardCopy, Plus, ShieldCheck, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Avatar } from '@/components/ui/Avatar'
import { VaultGate } from '@/components/vault/VaultGate'
import { VaultItemDetail } from '@/components/vault/VaultItemDetail'
import { VaultItemEditor } from '@/components/vault/VaultItemEditor'
import { ResetVaultDialog } from '@/components/vault/VaultDialogs'
import { deleteVaultItem, loadVault, saveVaultItem, useVault } from '@/hooks/useVault'
import { useToast } from '@/context/ToastContext'
import { copyToClipboard } from '@/lib/clipboard'
import { VAULT_TYPE_META, itemSubtitle } from '@/lib/vaultMeta'
import { getErrorMessage } from '@/lib/errors'
import { cn } from '@/lib/cn'
import type { VaultItem, VaultItemContent } from '@/types'

/** Every field as "Label: value" lines — for pasting into an email or a form helper. */
function asText(item: VaultItem): string {
  return VAULT_TYPE_META.person.fields
    .filter((f) => item.fields[f.key])
    .map((f) => `${f.label}: ${item.fields[f.key]}`)
    .join('\n')
}

/** Family members' form details, kept in the encrypted Vault (type "person"). */
export function FormKitSection() {
  const vault = useVault()
  const { showToast } = useToast()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editor, setEditor] = useState<VaultItem | 'new' | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<VaultItem | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)

  useEffect(() => {
    void loadVault()
  }, [])

  const people = useMemo(() => vault.items.filter((i) => i.type === 'person').sort((a, b) => a.title.localeCompare(b.title)), [vault.items])
  const selected = people.find((p) => p.id === selectedId) ?? null

  if (vault.phase !== 'unlocked') {
    return (
      <>
        <p className="mb-2 flex items-center gap-1.5 text-[11.5px] text-ink-soft">
          <ShieldCheck size={13} className="text-success" /> Form kits hold PAN, Aadhaar and passport numbers, so they live in your encrypted Vault.
        </p>
        <VaultGate phase={vault.phase} error={vault.error} onForgot={() => setResetOpen(true)} />
        <ResetVaultDialog open={resetOpen} onClose={() => setResetOpen(false)} />
      </>
    )
  }

  const save = async (content: VaultItemContent) => {
    setSaving(true)
    try {
      const item = await saveVaultItem({ ...content, type: 'person' }, editor && editor !== 'new' ? editor.id : undefined)
      showToast(editor === 'new' ? `${item.title} added` : 'Saved')
      setEditor(null)
      setSelectedId(item.id)
    } catch (err) {
      showToast(getErrorMessage(err, "Couldn't save."), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-ink-soft">Filling a form for Mom or Dad? Every detail is one tap to copy — encrypted, and cleared from the clipboard after 30 seconds.</p>
        <Button size="sm" className="shrink-0 self-start sm:self-auto" icon={<Plus size={13} />} onClick={() => setEditor('new')}>
          Add family member
        </Button>
      </div>

      {people.length === 0 ? (
        <EmptyState
          icon={<UserRound size={20} />}
          title="No form kits yet"
          description="Add yourself, your parents and spouse once — name, DOB, PAN, Aadhaar, passport, address, bank — and never dig for them again."
          action={
            <Button size="sm" icon={<Plus size={13} />} onClick={() => setEditor('new')}>
              Add the first person
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(240px,320px)_1fr]">
          <ul className={cn('space-y-2', selected && 'hidden lg:block')}>
            {people.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-card border bg-card px-3.5 py-3 text-left transition-colors hover:bg-bg-soft',
                    selectedId === p.id ? 'border-rust/40' : 'border-border-soft',
                  )}
                >
                  <Avatar name={p.title} size={38} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-ink">{p.title}</span>
                    <span className="block truncate text-[11px] text-ink-muted">{itemSubtitle(p)}</span>
                  </span>
                  <span className="shrink-0 text-[10.5px] text-ink-muted">{Object.keys(p.fields).length} details</span>
                </button>
              </li>
            ))}
          </ul>

          <div className={cn('overflow-hidden rounded-card border border-border bg-card shadow-card', !selected && 'hidden lg:block')}>
            {selected ? (
              <>
                <VaultItemDetail
                  key={selected.id}
                  item={selected}
                  reused={false}
                  onEdit={() => setEditor(selected)}
                  onDelete={() => setDeleteTarget(selected)}
                  onToggleFavorite={() => void saveVaultItem({ ...selected, favorite: !selected.favorite }, selected.id)}
                  onBack={() => setSelectedId(null)}
                />
                <div className="border-t border-border-soft px-5 py-3">
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<ClipboardCopy size={13} />}
                    onClick={async () => {
                      const ok = await copyToClipboard(asText(selected), true)
                      showToast(ok ? 'All details copied — cleared from the clipboard in 30 s' : 'Your browser blocked copying.', ok ? 'success' : 'error')
                    }}
                  >
                    Copy all details
                  </Button>
                </div>
              </>
            ) : (
              <p className="flex min-h-[300px] items-center justify-center px-6 text-center text-xs text-ink-muted">Pick a family member to see and copy their details.</p>
            )}
          </div>
        </div>
      )}

      <VaultItemEditor
        open={editor !== null}
        item={editor === 'new' ? null : editor}
        initialType="person"
        groups={['Family']}
        onClose={() => setEditor(null)}
        onSave={(content) => void save(content)}
        saving={saving}
      />
      <ConfirmDialog
        open={deleteTarget !== null}
        title={`Delete ${deleteTarget?.title ?? ''}'s form kit?`}
        description="It's removed from your vault for good."
        confirmLabel="Delete"
        destructive
        loading={deleting}
        loadingLabel="Deleting…"
        onConfirm={async () => {
          if (!deleteTarget) return
          setDeleting(true)
          try {
            await deleteVaultItem(deleteTarget.id)
            setSelectedId(null)
            setDeleteTarget(null)
            showToast('Deleted')
          } catch (err) {
            showToast(getErrorMessage(err, "Couldn't delete."), 'error')
          } finally {
            setDeleting(false)
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
