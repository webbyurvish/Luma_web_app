import { useEffect, useId, useState } from 'react'
import { Star } from 'lucide-react'
import { SlideOver } from '@/components/ui/SlideOver'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ThemedSelect } from '@/components/ui/ThemedSelect'
import { SecretInput } from './SecretInput'
import { cn } from '@/lib/cn'
import {
  VAULT_GROUP_SUGGESTIONS,
  VAULT_NOTES_MAX,
  VAULT_TYPES,
  VAULT_TYPE_META,
  cardNetwork,
  emptyContent,
  formatCardNumber,
  formatExpiry,
  luhnValid,
  type VaultFieldDef,
} from '@/lib/vaultMeta'
import type { VaultItem, VaultItemContent, VaultItemType } from '@/types'

interface VaultItemEditorProps {
  open: boolean
  /** null = new item. */
  item: VaultItem | null
  /** Pre-selects the type for a new item (skips the picker). */
  initialType?: VaultItemType | null
  groups: string[]
  onClose: () => void
  onSave: (content: VaultItemContent) => void
  saving?: boolean
}

function toContent(item: VaultItem): VaultItemContent {
  return { type: item.type, title: item.title, group: item.group, favorite: item.favorite, fields: { ...item.fields }, notes: item.notes }
}

export function VaultItemEditor({ open, item, initialType, groups, onClose, onSave, saving }: VaultItemEditorProps) {
  const [form, setForm] = useState<VaultItemContent | null>(null)
  const [initial, setInitial] = useState<string>('')
  const [attempted, setAttempted] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const groupListId = useId()

  useEffect(() => {
    if (!open) return
    const next = item ? toContent(item) : initialType ? emptyContent(initialType) : null
    setForm(next)
    setInitial(JSON.stringify(next))
    setAttempted(false)
  }, [open, item, initialType])

  const dirty = form !== null && JSON.stringify(form) !== initial && !(initial === 'null' && !form.title && !Object.values(form.fields).some(Boolean) && !form.notes)
  const requestClose = () => (dirty ? setConfirmDiscard(true) : onClose())

  const meta = form ? VAULT_TYPE_META[form.type] : null
  const errors = form
    ? {
        title: form.title.trim() ? '' : 'Give it a name you will recognise.',
        notes:
          form.notes.length > VAULT_NOTES_MAX
            ? `Keep notes under ${VAULT_NOTES_MAX.toLocaleString()} characters.`
            : form.type === 'note' && !form.notes.trim()
              ? 'Write the note.'
              : '',
      }
    : { title: '', notes: '' }
  const valid = !errors.title && !errors.notes

  const setField = (key: string, value: string) => setForm((f) => (f ? { ...f, fields: { ...f.fields, [key]: value } } : f))

  const save = () => {
    setAttempted(true)
    if (!form || !valid) return
    onSave(form)
  }

  const groupOptions = [...new Set([...VAULT_GROUP_SUGGESTIONS, ...groups])]

  return (
    <>
      <SlideOver
        open={open}
        onClose={requestClose}
        title={item ? `Edit ${item.title}` : meta ? `New ${meta.label.toLowerCase()}` : 'Add to vault'}
        subtitle={form ? 'Encrypted on this device before it is saved' : 'What would you like to keep safe?'}
        busy={saving}
        busyLabel="Encrypting and saving…"
        footer={
          form && (
            <div className="flex items-center justify-between gap-2">
              {!item ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => setForm(null)}>
                  Change type
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={requestClose}>
                  Cancel
                </Button>
                <Button type="button" size="sm" onClick={save} loading={saving} loadingText="Saving…" disabled={!!item && !dirty}>
                  {item ? 'Save changes' : 'Save to vault'}
                </Button>
              </div>
            </div>
          )
        }
      >
        {!form || !meta ? (
          <div className="grid grid-cols-2 gap-2.5">
            {VAULT_TYPES.map((type) => {
              const t = VAULT_TYPE_META[type]
              const Icon = t.icon
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    const next = emptyContent(type)
                    setForm(next)
                    setInitial('null')
                  }}
                  className="flex flex-col items-start gap-2 rounded-card border border-border bg-surface px-3.5 py-3.5 text-left transition-colors hover:border-rust/60 hover:bg-bg-soft"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-rust/10 text-rust">
                    <Icon size={15} />
                  </span>
                  <span>
                    <span className="block text-xs font-semibold text-ink">{t.label}</span>
                    <span className="block text-[10.5px] leading-snug text-ink-muted">{t.description}</span>
                  </span>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor="vault-title">Name</Label>
              <Input
                id="vault-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder={meta.titlePlaceholder}
                autoComplete="off"
                autoFocus={!item}
                className={cn(attempted && errors.title && 'border-danger')}
              />
              {attempted && errors.title && <FieldError>{errors.title}</FieldError>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {meta.fields.map((def) => (
                <div key={def.key} className={def.half ? 'col-span-1' : 'col-span-2'}>
                  <Label htmlFor={`vault-f-${def.key}`}>{def.label}</Label>
                  <FieldInput def={def} value={form.fields[def.key] ?? ''} onChange={(v) => setField(def.key, v)} />
                </div>
              ))}
            </div>

            <div>
              <Label htmlFor="vault-notes">{form.type === 'note' ? 'Note' : 'Notes (optional)'}</Label>
              <textarea
                id="vault-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={form.type === 'note' ? 9 : 3}
                spellCheck={false}
                placeholder={form.type === 'note' ? 'Recovery codes, locker numbers, anything private…' : 'Security questions, hints, customer care number…'}
                className={cn(
                  'w-full resize-y rounded-sm border bg-surface px-3 py-2 text-xs leading-relaxed text-ink placeholder:text-ink-muted focus:border-rust focus:outline-none',
                  attempted && errors.notes ? 'border-danger' : 'border-border',
                )}
              />
              {attempted && errors.notes && <FieldError>{errors.notes}</FieldError>}
            </div>

            <div className="grid grid-cols-[1fr_auto] items-end gap-3">
              <div>
                <Label htmlFor="vault-group">Group</Label>
                <Input id="vault-group" list={groupListId} value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })} placeholder="Personal" autoComplete="off" />
                <datalist id={groupListId}>
                  {groupOptions.map((g) => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
              </div>
              <button
                type="button"
                onClick={() => setForm({ ...form, favorite: !form.favorite })}
                aria-pressed={form.favorite}
                className={cn(
                  'flex h-9 items-center gap-1.5 rounded-sm border px-3 text-xs transition-colors',
                  form.favorite ? 'border-warning/40 bg-warning-soft text-ink' : 'border-border text-ink-soft hover:bg-bg-soft',
                )}
              >
                <Star size={13} className={form.favorite ? 'text-warning' : ''} fill={form.favorite ? 'currentColor' : 'none'} />
                Favourite
              </button>
            </div>
          </div>
        )}
      </SlideOver>

      <ConfirmDialog
        open={confirmDiscard}
        title="Discard changes?"
        description="What you typed hasn't been saved to the vault."
        confirmLabel="Discard"
        destructive
        onConfirm={() => {
          setConfirmDiscard(false)
          onClose()
        }}
        onCancel={() => setConfirmDiscard(false)}
      />
    </>
  )
}

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-medium text-ink-soft">
      {children}
    </label>
  )
}

function FieldError({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-[11px] text-danger">{children}</p>
}

function FieldInput({ def, value, onChange }: { def: VaultFieldDef; value: string; onChange: (value: string) => void }) {
  const id = `vault-f-${def.key}`
  switch (def.kind) {
    case 'secret':
      return <SecretInput id={id} value={value} onChange={onChange} generator={def.key === 'password' || def.key === 'netBankingPassword'} meter />
    case 'pin':
      return <SecretInput id={id} value={value} onChange={(v) => onChange(v.replace(/\D/g, '').slice(0, 8))} inputMode="numeric" />
    case 'textarea':
      return (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder={def.placeholder}
          className="w-full resize-y rounded-sm border border-border bg-surface px-3 py-2 text-xs leading-relaxed text-ink placeholder:text-ink-muted focus:border-rust focus:outline-none"
        />
      )
    case 'select':
      return <ThemedSelect id={id} value={value} onChange={onChange} placeholder="Choose…" options={(def.options ?? []).map((o) => ({ value: o, label: o }))} />
    case 'cardNumber': {
      const network = cardNetwork(value)
      const digits = value.replace(/\D/g, '')
      return (
        <>
          <div className="relative">
            <Input
              id={id}
              value={formatCardNumber(value)}
              onChange={(e) => onChange(formatCardNumber(e.target.value))}
              inputMode="numeric"
              autoComplete="off"
              placeholder="1234 5678 9012 3456"
              className="pr-24 font-mono-figure"
            />
            {network && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold italic text-ink-soft">{network}</span>}
          </div>
          {digits.length >= 13 && !luhnValid(digits) && <p className="mt-1 text-[11px] text-warning">This number doesn't pass the card checksum — check for a typo.</p>}
        </>
      )
    }
    case 'expiry':
      return <Input id={id} value={value} onChange={(e) => onChange(formatExpiry(e.target.value))} inputMode="numeric" placeholder="MM/YY" autoComplete="off" className="font-mono-figure" />
    default:
      return (
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(def.key === 'ifsc' ? e.target.value.toUpperCase() : e.target.value)}
          placeholder={def.placeholder}
          inputMode={def.inputMode}
          autoComplete="off"
          spellCheck={false}
          className={cn(def.sensitive && 'font-mono-figure')}
        />
      )
  }
}
