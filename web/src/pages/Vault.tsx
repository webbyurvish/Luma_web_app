import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, KeyRound, Lock, Plus, Search, ShieldCheck, Star } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { SyncBar } from '@/components/ui/Loader'
import { VaultGate } from '@/components/vault/VaultGate'
import { VaultItemDetail } from '@/components/vault/VaultItemDetail'
import { VaultItemEditor } from '@/components/vault/VaultItemEditor'
import { ChangeMasterDialog, ResetVaultDialog } from '@/components/vault/VaultDialogs'
import { useToast } from '@/context/ToastContext'
import { deleteVaultItem, loadVault, lockVault, saveVaultItem, useVault } from '@/hooks/useVault'
import { cn } from '@/lib/cn'
import { getErrorMessage } from '@/lib/errors'
import { VAULT_TYPES, VAULT_TYPE_META, itemExpiry, itemSubtitle, passwordStrength, reusedPasswordIds, searchText } from '@/lib/vaultMeta'
import type { VaultItem, VaultItemContent, VaultItemType } from '@/types'

type Filter = 'all' | 'favorites' | 'attention' | VaultItemType

export function Vault() {
  const vault = useVault()
  const { showToast } = useToast()
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editor, setEditor] = useState<{ item: VaultItem | null; type: VaultItemType | null } | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<VaultItem | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [favBusy, setFavBusy] = useState(false)
  const [changeOpen, setChangeOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)

  useEffect(() => {
    void loadVault()
  }, [])

  // Leaving the page doesn't lock (the idle timer does), but the selection resets when locked.
  useEffect(() => {
    if (vault.phase !== 'unlocked') setSelectedId(null)
  }, [vault.phase])

  const reused = useMemo(() => reusedPasswordIds(vault.items), [vault.items])
  const needsAttention = (item: VaultItem) => {
    const exp = itemExpiry(item)
    const pw = item.fields.password
    return exp === 'expired' || exp === 'soon' || reused.has(item.id) || (!!pw && passwordStrength(pw).score <= 1)
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: vault.items.length, favorites: 0, attention: 0 }
    vault.items.forEach((item) => {
      c[item.type] = (c[item.type] ?? 0) + 1
      if (item.favorite) c.favorites++
      if (needsAttention(item)) c.attention++
    })
    return c
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vault.items, reused])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return vault.items
      .filter((item) => {
        if (filter === 'favorites' && !item.favorite) return false
        if (filter === 'attention' && !needsAttention(item)) return false
        if (filter !== 'all' && filter !== 'favorites' && filter !== 'attention' && item.type !== filter) return false
        return !q || searchText(item).includes(q)
      })
      .sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.title.localeCompare(b.title))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vault.items, filter, search, reused])

  const groups = useMemo(() => [...new Set(vault.items.map((i) => i.group).filter(Boolean))], [vault.items])
  const selected = vault.items.find((i) => i.id === selectedId) ?? null

  if (vault.phase !== 'unlocked') {
    return (
      <>
        <VaultGate phase={vault.phase} error={vault.error} onForgot={() => setResetOpen(true)} />
        <ResetVaultDialog open={resetOpen} onClose={() => setResetOpen(false)} />
      </>
    )
  }

  const handleSave = async (content: VaultItemContent) => {
    setSaving(true)
    try {
      const saved = await saveVaultItem(content, editor?.item?.id)
      showToast(editor?.item ? 'Saved' : `${VAULT_TYPE_META[content.type].label} added to your vault`)
      setEditor(null)
      setSelectedId(saved.id)
    } catch (err) {
      showToast(getErrorMessage(err, "Couldn't save to the vault."), 'error')
    } finally {
      setSaving(false)
    }
  }

  const toggleFavorite = async (item: VaultItem) => {
    setFavBusy(true)
    try {
      await saveVaultItem({ type: item.type, title: item.title, group: item.group, favorite: !item.favorite, fields: item.fields, notes: item.notes }, item.id)
    } catch (err) {
      showToast(getErrorMessage(err, "Couldn't update the item."), 'error')
    } finally {
      setFavBusy(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteVaultItem(deleteTarget.id)
      showToast('Deleted from your vault')
      if (selectedId === deleteTarget.id) setSelectedId(null)
      setDeleteTarget(null)
    } catch (err) {
      showToast(getErrorMessage(err, "Couldn't delete the item."), 'error')
    } finally {
      setDeleting(false)
    }
  }

  const chips: { id: Filter; label: string; icon?: React.ReactNode }[] = [
    { id: 'all', label: 'All' },
    { id: 'favorites', label: 'Favourites', icon: <Star size={11} /> },
    ...(counts.attention ? [{ id: 'attention' as Filter, label: 'Needs attention', icon: <AlertTriangle size={11} /> }] : []),
    ...VAULT_TYPES.map((t) => ({ id: t as Filter, label: VAULT_TYPE_META[t].plural })),
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[200px] flex-1">
          <Input icon={<Search size={14} />} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search names, usernames, banks…" aria-label="Search the vault" />
        </div>
        <Button icon={<Plus size={14} />} onClick={() => setEditor({ item: null, type: null })}>
          Add
        </Button>
        <Button variant="secondary" icon={<Lock size={13} />} onClick={lockVault} title="Lock the vault now">
          Lock
        </Button>
      </div>

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {chips.map((chip) => {
          const n = counts[chip.id] ?? 0
          if (chip.id !== 'all' && chip.id !== 'favorites' && n === 0) return null
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => setFilter(chip.id)}
              aria-pressed={filter === chip.id}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] transition-colors',
                filter === chip.id ? 'border-ink bg-ink text-paper' : 'border-border text-ink-soft hover:bg-bg-soft hover:text-ink',
                chip.id === 'attention' && filter !== chip.id && 'border-warning/40 text-ink',
              )}
            >
              {chip.icon}
              {chip.label}
              <span className={cn('font-mono-figure text-[10.5px]', filter === chip.id ? 'text-paper/70' : 'text-ink-muted')}>{n}</span>
            </button>
          )
        })}
      </div>

      {vault.unreadable > 0 && (
        <p className="flex items-center gap-2 rounded-sm bg-danger-soft px-3 py-2 text-[11.5px] text-danger">
          <AlertTriangle size={13} /> {vault.unreadable} item(s) couldn't be decrypted with this master password.
        </p>
      )}

      {vault.items.length === 0 ? (
        <div className="rounded-card border border-border bg-card shadow-card">
          <EmptyState
            icon={<ShieldCheck size={22} />}
            title="Your vault is ready"
            description="Add your first password, card or bank detail. It's encrypted on this device before it's saved."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {(['login', 'card', 'bank'] as VaultItemType[]).map((t) => {
                  const Icon = VAULT_TYPE_META[t].icon
                  return (
                    <Button key={t} variant="secondary" size="sm" icon={<Icon size={13} />} onClick={() => setEditor({ item: null, type: t })}>
                      {VAULT_TYPE_META[t].label}
                    </Button>
                  )
                })}
              </div>
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(280px,360px)_1fr]">
          <div className={cn('relative overflow-hidden rounded-card border border-border bg-card shadow-card', selected && 'hidden lg:block')}>
            <SyncBar active={vault.refreshing} className="absolute inset-x-0 top-0" />
            {visible.length === 0 ? (
              <p className="px-4 py-10 text-center text-xs text-ink-muted">Nothing matches{search ? ` “${search}”` : ''}.</p>
            ) : (
              <ul className="max-h-[calc(100vh-260px)] min-h-[200px] divide-y divide-border-soft overflow-y-auto">
                {visible.map((item) => {
                  const Icon = VAULT_TYPE_META[item.type].icon
                  const exp = itemExpiry(item)
                  const flagged = needsAttention(item)
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(item.id)}
                        aria-current={selectedId === item.id || undefined}
                        className={cn(
                          'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-bg-soft',
                          selectedId === item.id && 'bg-bg-soft',
                        )}
                      >
                        <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', selectedId === item.id ? 'bg-rust/10 text-rust' : 'bg-bg-soft text-ink-soft')}>
                          <Icon size={14} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-xs font-medium text-ink">{item.title}</span>
                            {item.favorite && <Star size={10} className="shrink-0 text-warning" fill="currentColor" />}
                          </span>
                          <span className="block truncate font-mono-figure text-[10.5px] text-ink-muted">{itemSubtitle(item)}</span>
                        </span>
                        {exp === 'expired' ? (
                          <span className="shrink-0 rounded-full bg-danger-soft px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-danger">Expired</span>
                        ) : flagged ? (
                          <AlertTriangle size={13} className="shrink-0 text-warning" aria-label="Needs attention" />
                        ) : null}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className={cn('min-h-[420px] overflow-hidden rounded-card border border-border bg-card shadow-card', !selected && 'hidden lg:block')}>
            {selected ? (
              <VaultItemDetail
                key={selected.id}
                item={selected}
                reused={reused.has(selected.id)}
                onEdit={() => setEditor({ item: selected, type: selected.type })}
                onDelete={() => setDeleteTarget(selected)}
                onToggleFavorite={() => void toggleFavorite(selected)}
                favoriteBusy={favBusy}
                onBack={() => setSelectedId(null)}
              />
            ) : (
              <div className="flex h-full min-h-[420px] flex-col items-center justify-center px-6 text-center">
                <KeyRound size={22} className="text-ink-muted" />
                <p className="mt-3 text-xs font-medium text-ink">Pick an item to see its details</p>
                <p className="mt-1 max-w-xs text-[11px] leading-relaxed text-ink-muted">Secrets stay hidden until you reveal them, and copied passwords clear from the clipboard after 30 seconds.</p>
              </div>
            )}
          </div>
        </div>
      )}

      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-ink-muted">
        <span className="flex items-center gap-1">
          <ShieldCheck size={11} /> End-to-end encrypted · locks after 5 min idle
        </span>
        <button type="button" onClick={() => setChangeOpen(true)} className="underline-offset-2 hover:text-ink hover:underline">
          Change master password
        </button>
      </p>

      <VaultItemEditor
        open={editor !== null}
        item={editor?.item ?? null}
        initialType={editor?.type ?? null}
        groups={groups}
        onClose={() => setEditor(null)}
        onSave={(content) => void handleSave(content)}
        saving={saving}
      />
      <ConfirmDialog
        open={deleteTarget !== null}
        title={`Delete “${deleteTarget?.title ?? ''}”?`}
        description="It's removed from your vault for good — there is no copy anywhere else."
        confirmLabel="Delete"
        destructive
        loading={deleting}
        loadingLabel="Deleting…"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
      <ChangeMasterDialog open={changeOpen} onClose={() => setChangeOpen(false)} />
    </div>
  )
}
