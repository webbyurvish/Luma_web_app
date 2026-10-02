import { useEffect, useState } from 'react'
import { AlertTriangle, ArrowLeft, Check, Copy, ExternalLink, Eye, EyeOff, Pencil, Star, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/context/ToastContext'
import { copyToClipboard } from '@/lib/clipboard'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/formatDate'
import { PaymentCard } from './PaymentCard'
import { VAULT_TYPE_META, formatCardNumber, hostOf, itemExpiry, luhnValid, maskValue, passwordStrength, safeHref, type VaultFieldDef } from '@/lib/vaultMeta'
import type { VaultItem } from '@/types'

const AUTO_HIDE_MS = 30_000

interface VaultItemDetailProps {
  item: VaultItem
  reused: boolean
  onEdit: () => void
  onDelete: () => void
  onToggleFavorite: () => void
  favoriteBusy?: boolean
  /** Small screens: back to the list. */
  onBack?: () => void
}

export function VaultItemDetail({ item, reused, onEdit, onDelete, onToggleFavorite, favoriteBusy, onBack }: VaultItemDetailProps) {
  const { showToast } = useToast()
  const meta = VAULT_TYPE_META[item.type]
  const Icon = meta.icon
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState<string | null>(null)

  // Anything revealed hides itself again after 30 seconds.
  useEffect(() => {
    if (!revealed.size) return
    const id = window.setTimeout(() => setRevealed(new Set()), AUTO_HIDE_MS)
    return () => window.clearTimeout(id)
  }, [revealed])

  const toggle = (key: string) =>
    setRevealed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const copy = async (def: VaultFieldDef | null, value: string) => {
    const raw = def?.kind === 'cardNumber' ? value.replace(/\s/g, '') : value
    const ok = await copyToClipboard(raw, !!def?.sensitive)
    if (!ok) {
      showToast("Your browser blocked copying — reveal the value and copy it by hand.", 'error')
      return
    }
    const key = def?.key ?? 'notes'
    setCopied(key)
    window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500)
    showToast(def?.sensitive ? `${def.label} copied — clears from the clipboard in 30 s` : `${def?.label ?? 'Notes'} copied`)
  }

  const filled = meta.fields.filter((def) => item.fields[def.key])
  const expiry = itemExpiry(item)
  const strength = item.fields.password ? passwordStrength(item.fields.password) : null
  const link = item.type === 'login' ? safeHref(item.fields.website) : null
  const cardNumber = item.fields.number ?? ''

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start gap-3 border-b border-border-soft px-5 py-4">
        {onBack && (
          <button type="button" onClick={onBack} aria-label="Back to list" className="-ml-1.5 mt-1 rounded-full p-1.5 text-ink-muted hover:bg-bg-soft hover:text-ink lg:hidden">
            <ArrowLeft size={16} />
          </button>
        )}
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg-soft text-ink-soft">
          <Icon size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-xl italic text-ink">{item.title}</h2>
          <p className="mt-0.5 text-[11px] text-ink-muted">
            {meta.label}
            {item.group && ` · ${item.group}`}
            {item.type === 'card' && item.fields.cardKind && ` · ${item.fields.cardKind}`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={onToggleFavorite}
            disabled={favoriteBusy}
            aria-pressed={item.favorite}
            aria-label={item.favorite ? 'Remove from favourites' : 'Add to favourites'}
            className={cn('rounded-full p-2 transition-colors hover:bg-bg-soft disabled:opacity-50', item.favorite ? 'text-warning' : 'text-ink-muted hover:text-ink')}
          >
            <Star size={15} fill={item.favorite ? 'currentColor' : 'none'} />
          </button>
          <button type="button" onClick={onEdit} aria-label="Edit" className="rounded-full p-2 text-ink-muted transition-colors hover:bg-bg-soft hover:text-ink">
            <Pencil size={15} />
          </button>
          <button type="button" onClick={onDelete} aria-label="Delete" className="rounded-full p-2 text-ink-muted transition-colors hover:bg-danger-soft hover:text-danger">
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {(expiry === 'expired' || expiry === 'soon' || reused || (strength && strength.score <= 1) || (item.type === 'card' && cardNumber && !luhnValid(cardNumber))) && (
          <div className="mb-4 space-y-1.5">
            {expiry === 'expired' && <Warning tone="danger">This has expired — update it with the new details.</Warning>}
            {expiry === 'soon' && <Warning tone="warning">Expires within 60 days.</Warning>}
            {reused && <Warning tone="warning">This password is used for another item too. A unique one is safer.</Warning>}
            {strength && strength.score <= 1 && <Warning tone="warning">Weak password — consider generating a stronger one.</Warning>}
            {item.type === 'card' && cardNumber && !luhnValid(cardNumber) && <Warning tone="warning">The card number looks mistyped (checksum failed).</Warning>}
          </div>
        )}

        {item.type === 'card' && (
          <div className="mb-5">
            <PaymentCard
              title={item.title}
              issuer={item.fields.issuer}
              holder={item.fields.holder}
              number={cardNumber}
              expiry={item.fields.expiry}
              kind={item.fields.cardKind}
              revealed={revealed.has('number')}
            />
          </div>
        )}

        {filled.length > 0 && (
          <dl className="divide-y divide-border-soft rounded-card border border-border-soft">
            {filled.map((def) => {
              const value = item.fields[def.key]
              const isOpen = !def.sensitive || revealed.has(def.key)
              const display = isOpen ? (def.kind === 'cardNumber' ? formatCardNumber(value) : value) : maskValue(value, def.showLast4)
              return (
                <div key={def.key} className="group flex items-center gap-2 px-3.5 py-2.5">
                  <div className="min-w-0 flex-1">
                    <dt className="text-[10px] font-medium uppercase tracking-[0.08em] text-ink-muted">{def.label}</dt>
                    <dd className={cn('mt-0.5 text-[13px] text-ink', def.kind === 'textarea' ? 'whitespace-pre-wrap break-words' : 'break-all', (def.sensitive || def.kind === 'cardNumber') && 'font-mono-figure')}>
                      {def.kind === 'url' && link ? (
                        <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-rust hover:underline">
                          {hostOf(value)} <ExternalLink size={11} />
                        </a>
                      ) : (
                        display
                      )}
                    </dd>
                  </div>
                  {def.sensitive && (
                    <button
                      type="button"
                      onClick={() => toggle(def.key)}
                      aria-label={isOpen ? `Hide ${def.label}` : `Show ${def.label}`}
                      className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-bg-soft hover:text-ink"
                    >
                      {isOpen ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  )}
                  {(def.copy || def.kind === 'url') && (
                    <button
                      type="button"
                      onClick={() => void copy(def, value)}
                      aria-label={`Copy ${def.label}`}
                      className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-bg-soft hover:text-ink"
                    >
                      {copied === def.key ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                    </button>
                  )}
                </div>
              )
            })}
          </dl>
        )}

        {item.notes && (
          <div className={cn(filled.length > 0 && 'mt-5')}>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-muted">{item.type === 'note' ? 'Note' : 'Notes'}</p>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => toggle('notes')}
                  aria-label={revealed.has('notes') ? 'Hide note' : 'Show note'}
                  className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-bg-soft hover:text-ink"
                >
                  {revealed.has('notes') ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <button type="button" onClick={() => void copy(null, item.notes)} aria-label="Copy note" className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-bg-soft hover:text-ink">
                  {copied === 'notes' ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
            {revealed.has('notes') ? (
              <p className="whitespace-pre-wrap break-words rounded-card border border-border-soft bg-bg-soft/50 px-3.5 py-3 text-[12.5px] leading-relaxed text-ink">{item.notes}</p>
            ) : (
              <button
                type="button"
                onClick={() => toggle('notes')}
                className="flex w-full items-center justify-center gap-1.5 rounded-card border border-dashed border-border px-3.5 py-5 text-[11.5px] text-ink-muted transition-colors hover:border-ink-soft/50 hover:text-ink"
              >
                <Eye size={13} /> Tap to show
              </button>
            )}
          </div>
        )}

        {filled.length === 0 && !item.notes && <p className="text-xs text-ink-muted">Nothing saved in this item yet.</p>}

        <p className="mt-6 text-[10.5px] text-ink-muted">
          Added {formatDate(item.createdAt)}
          {item.updatedAt && item.updatedAt !== item.createdAt && ` · Updated ${formatDate(item.updatedAt)}`}
        </p>
        <Button variant="secondary" size="sm" className="mt-3 lg:hidden" icon={<Pencil size={12} />} onClick={onEdit}>
          Edit
        </Button>
      </div>
    </div>
  )
}

function Warning({ tone, children }: { tone: 'warning' | 'danger'; children: React.ReactNode }) {
  return (
    <p
      className={cn(
        'flex items-start gap-2 rounded-sm px-3 py-2 text-[11.5px] leading-relaxed',
        tone === 'danger' ? 'bg-danger-soft text-danger' : 'bg-warning-soft text-ink',
      )}
    >
      <AlertTriangle size={13} className={cn('mt-0.5 shrink-0', tone === 'warning' && 'text-warning')} />
      {children}
    </p>
  )
}
