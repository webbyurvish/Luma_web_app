import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, Folder, FolderCheck, Plus, Trash2, UserPlus, X } from 'lucide-react'
import { SlideOver } from '@/components/ui/SlideOver'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ThemedSelect } from '@/components/ui/ThemedSelect'
import { useAccounts } from '@/hooks/useFinanceCollections'
import { cn } from '@/lib/cn'
import {
  CATEGORIES,
  ROLE_DEFAULTS,
  ROLE_LABELS,
  buildFamilyTree,
  currentFy,
  newAccountRef,
  newPerson,
  type AccountRef,
  type FamilyConfig,
  type FolderSpec,
  type PersonConfig,
  type PersonRole,
} from '@/lib/familyFolders'
import type { DriveFolder } from '@/types'

interface FamilyStructureWizardProps {
  open: boolean
  rootId: string
  /** Existing folders, so the preview can show what's already there. */
  childFolders: Map<string, DriveFolder[]>
  onClose: () => void
  onCreate: (tree: FolderSpec[]) => Promise<void>
}

const ROLE_OPTIONS = (Object.keys(ROLE_LABELS) as PersonRole[]).map((r) => ({ value: r, label: ROLE_LABELS[r] }))
const ADDABLE: PersonRole[] = ['spouse', 'parent', 'child', 'sibling', 'other']

interface PreviewNode {
  name: string
  exists: boolean
  children: PreviewNode[]
}

/** Marks every folder in the spec as new or already in Drive (matched by name under the same parent). */
function annotate(spec: FolderSpec[], parentId: string | null, childFolders: Map<string, DriveFolder[]>): PreviewNode[] {
  return spec.map((node) => {
    const match = parentId ? childFolders.get(parentId)?.find((f) => f.name === node.name) : undefined
    return { name: node.name, exists: !!match, children: annotate(node.children ?? [], match?.id ?? null, childFolders) }
  })
}

function countNew(nodes: PreviewNode[]): { fresh: number; existing: number } {
  return nodes.reduce(
    (acc, n) => {
      const inner = countNew(n.children)
      return { fresh: acc.fresh + (n.exists ? 0 : 1) + inner.fresh, existing: acc.existing + (n.exists ? 1 : 0) + inner.existing }
    },
    { fresh: 0, existing: 0 },
  )
}

export function FamilyStructureWizard({ open, rootId, childFolders, onClose, onCreate }: FamilyStructureWizardProps) {
  const { accounts } = useAccounts()
  const [config, setConfig] = useState<FamilyConfig | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fresh form on every open; "Me" starts with the bank accounts and cards Luma already knows.
  const prefilled = useRef(false)
  useEffect(() => {
    if (!open) return
    const me = newPerson('self', 'Me')
    setConfig({ people: [me], inbox: true, shared: true, joint: [], emergency: true, archive: true })
    setExpanded(me.id)
    setError(null)
    prefilled.current = false
  }, [open])

  // Fill "Me" from Luma's accounts — also when they finish loading after the panel opened.
  useEffect(() => {
    if (!open || prefilled.current || !accounts.length) return
    const active = accounts.filter((a) => a.isActive)
    const banks = active.filter((a) => a.type === 'bank').map((a) => newAccountRef(a.name, a.accountNumberLast4 ?? ''))
    const cards = active.filter((a) => a.type === 'credit_card').map((a) => newAccountRef(a.name, a.accountNumberLast4 ?? ''))
    setConfig((c) => {
      if (!c) return c
      prefilled.current = true
      const [me, ...rest] = c.people
      if (!me || me.role !== 'self' || me.banks.length || me.cards.length) return c
      return { ...c, people: [{ ...me, banks, cards }, ...rest] }
    })
  }, [open, accounts, config])

  const tree = useMemo(() => (config ? buildFamilyTree(config) : []), [config])
  const preview = useMemo(() => annotate(tree, rootId, childFolders), [tree, rootId, childFolders])
  const counts = useMemo(() => countNew(preview), [preview])

  if (!config) return null

  const updatePerson = (id: string, change: Partial<PersonConfig>) =>
    setConfig((c) => (c ? { ...c, people: c.people.map((p) => (p.id === id ? { ...p, ...change } : p)) } : c))

  const addPerson = (role: PersonRole) => {
    const person = newPerson(role)
    setConfig((c) => (c ? { ...c, people: [...c.people, person] } : c))
    setExpanded(person.id)
  }

  const create = async () => {
    setBusy(true)
    setError(null)
    try {
      await onCreate(tree)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the folders.")
    } finally {
      setBusy(false)
    }
  }

  const missingNames = config.people.some((p) => !p.name.trim())

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title="Family folder structure"
      subtitle="Set up organised folders for everyone in one go"
      className="sm:w-[560px] md:w-[620px]"
      busy={busy}
      busyLabel={`Creating ${counts.fresh} folders in Google Drive — this can take a minute…`}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-ink-muted">
            <span className="font-semibold text-ink">{counts.fresh}</span> new folders
            {counts.existing > 0 && <> · {counts.existing} already there (kept)</>}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={() => void create()} loading={busy} loadingText="Creating…" disabled={counts.fresh === 0 || missingNames}>
              {counts.fresh === 0 ? 'Everything exists' : `Create ${counts.fresh} folders`}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* People */}
        <section>
          <SectionTitle n={1} title="Who is in the family?" hint="Each person gets their own numbered folder. Tick what they need — you can add more later." />
          <div className="space-y-2.5">
            {config.people.map((person, index) => (
              <PersonCard
                key={person.id}
                person={person}
                index={index}
                open={expanded === person.id}
                onToggle={() => setExpanded((e) => (e === person.id ? null : person.id))}
                onChange={(change) => updatePerson(person.id, change)}
                onRemove={config.people.length > 1 ? () => setConfig({ ...config, people: config.people.filter((p) => p.id !== person.id) }) : undefined}
              />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {ADDABLE.map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => addPerson(role)}
                className="flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1.5 text-[11.5px] text-ink-soft transition-colors hover:border-rust/60 hover:text-ink"
              >
                <UserPlus size={12} /> {ROLE_LABELS[role]}
              </button>
            ))}
          </div>
        </section>

        {/* Shared */}
        <section>
          <SectionTitle n={2} title="Shared folders" />
          <div className="space-y-1.5">
            <Toggle checked={config.inbox} onChange={(v) => setConfig({ ...config, inbox: v })} title="00 Inbox (to sort)" hint="Drop new files here and file them later" />
            <Toggle
              checked={config.shared}
              onChange={(v) => setConfig({ ...config, shared: v })}
              title="01 Family (Shared)"
              hint="Joint accounts, home, utilities, family insurance, travel"
            />
            {config.shared && (
              <div className="ml-7 rounded-card border border-border-soft bg-bg-soft/40 px-3 py-2.5">
                <AccountList
                  title="Joint bank accounts"
                  placeholder="e.g. SBI Joint – Papa & Me"
                  items={config.joint}
                  onChange={(joint) => setConfig({ ...config, joint })}
                />
              </div>
            )}
            <Toggle checked={config.emergency} onChange={(v) => setConfig({ ...config, emergency: v })} title="02 Emergency Kit" hint="ID and insurance copies to open fast at a hospital" />
            <Toggle checked={config.archive} onChange={(v) => setConfig({ ...config, archive: v })} title="99 Archive" hint="Closed accounts, expired policies — never delete" />
          </div>
        </section>

        {/* Preview */}
        <section>
          <SectionTitle n={3} title="Preview" hint={`Statements and tax start with ${currentFy()}. Folders that already exist are reused, never duplicated.`} />
          <div className="max-h-80 overflow-y-auto rounded-card border border-border bg-surface px-3 py-2.5">
            <p className="mb-1 flex items-center gap-1.5 text-[11.5px] font-medium text-ink">
              <FolderCheck size={13} className="text-ink-muted" /> Luma Documents
            </p>
            <PreviewTree nodes={preview} depth={1} />
          </div>
        </section>

        {missingNames && <p className="text-[11.5px] text-danger">Give every family member a name.</p>}
        {error && (
          <p role="alert" className="rounded-sm bg-danger-soft px-3 py-2 text-[11.5px] text-danger">
            {error}
          </p>
        )}
      </div>
    </SlideOver>
  )
}

function SectionTitle({ n, title, hint }: { n: number; title: string; hint?: string }) {
  return (
    <div className="mb-3">
      <p className="flex items-center gap-2 text-xs font-semibold text-ink">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rust/10 font-mono-figure text-[10.5px] text-rust">{n}</span>
        {title}
      </p>
      {hint && <p className="ml-7 mt-0.5 text-[11px] leading-relaxed text-ink-muted">{hint}</p>}
    </div>
  )
}

function Toggle({ checked, onChange, title, hint }: { checked: boolean; onChange: (v: boolean) => void; title: string; hint: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-sm px-1 py-1.5 hover:bg-bg-soft/60">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-3.5 w-3.5 accent-rust" />
      <span>
        <span className="block text-xs font-medium text-ink">{title}</span>
        <span className="block text-[11px] text-ink-muted">{hint}</span>
      </span>
    </label>
  )
}

function PersonCard({
  person,
  index,
  open,
  onToggle,
  onChange,
  onRemove,
}: {
  person: PersonConfig
  index: number
  open: boolean
  onToggle: () => void
  onChange: (change: Partial<PersonConfig>) => void
  onRemove?: () => void
}) {
  const toggleCategory = (key: (typeof CATEGORIES)[number]['key']) =>
    onChange({ categories: person.categories.includes(key) ? person.categories.filter((k) => k !== key) : [...person.categories, key] })

  return (
    <div className={cn('rounded-card border bg-card transition-colors', open ? 'border-rust/40 shadow-card' : 'border-border')}>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button type="button" onClick={onToggle} aria-label={open ? 'Collapse' : 'Expand'} aria-expanded={open} className="rounded-full p-1 text-ink-muted hover:bg-bg-soft hover:text-ink">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <span className="w-6 shrink-0 font-mono-figure text-[11px] text-ink-muted">{(index + 1) * 10}</span>
        <div className="min-w-0 flex-1">
          <Input value={person.name} onChange={(e) => onChange({ name: e.target.value })} placeholder={`Name, e.g. ${person.role === 'parent' ? 'Papa' : person.role === 'child' ? 'Aarav' : ROLE_LABELS[person.role]}`} aria-label="Name" className="h-8" />
        </div>
        <div className="w-28 shrink-0">
          <ThemedSelect
            value={person.role}
            onChange={(role) => onChange({ role: role as PersonRole, categories: [...ROLE_DEFAULTS[role as PersonRole]] })}
            options={ROLE_OPTIONS}
            aria-label="Relation"
          />
        </div>
        {onRemove && (
          <button type="button" onClick={onRemove} aria-label={`Remove ${person.name || 'person'}`} className="rounded-full p-1.5 text-ink-muted hover:bg-danger-soft hover:text-danger">
            <Trash2 size={13} />
          </button>
        )}
      </div>
      {!open && (
        <p className="-mt-1 truncate px-3 pb-2.5 pl-[68px] text-[10.5px] text-ink-muted">
          {person.categories.length} categories
          {person.banks.length > 0 && ` · ${person.banks.length} bank account${person.banks.length > 1 ? 's' : ''}`}
          {person.cards.length > 0 && ` · ${person.cards.length} card${person.cards.length > 1 ? 's' : ''}`}
        </p>
      )}
      {open && (
        <div className="space-y-4 border-t border-border-soft px-3 py-3">
          <div>
            <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-muted">What to keep</p>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => {
                const on = person.categories.includes(cat.key)
                return (
                  <button
                    key={cat.key}
                    type="button"
                    title={cat.hint}
                    onClick={() => toggleCategory(cat.key)}
                    aria-pressed={on}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-[11px] transition-colors',
                      on ? 'border-ink bg-ink text-paper' : 'border-border text-ink-soft hover:bg-bg-soft hover:text-ink',
                    )}
                  >
                    {cat.label}
                  </button>
                )
              })}
            </div>
          </div>
          {person.categories.includes('banking') && (
            <AccountList title="Bank accounts" placeholder="e.g. HDFC Savings" items={person.banks} onChange={(banks) => onChange({ banks })} />
          )}
          {person.categories.includes('cards') && (
            <AccountList title="Credit cards" placeholder="e.g. ICICI Amazon Pay" items={person.cards} onChange={(cards) => onChange({ cards })} />
          )}
        </div>
      )}
    </div>
  )
}

function AccountList({ title, placeholder, items, onChange }: { title: string; placeholder: string; items: AccountRef[]; onChange: (items: AccountRef[]) => void }) {
  const update = (id: string, change: Partial<AccountRef>) => onChange(items.map((i) => (i.id === id ? { ...i, ...change } : i)))
  return (
    <div>
      <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-muted">{title}</p>
      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-1.5">
            <div className="min-w-0 flex-1">
              <Input value={item.label} onChange={(e) => update(item.id, { label: e.target.value })} placeholder={placeholder} aria-label={`${title} name`} className="h-8" />
            </div>
            <div className="w-[88px] shrink-0">
              <Input
                value={item.last4}
                // Pasting a full number keeps its last 4 digits.
                onChange={(e) => update(item.id, { last4: e.target.value.replace(/\D/g, '').slice(-4) })}
                placeholder="Last 4"
                inputMode="numeric"
                aria-label="Last 4 digits"
                className="h-8 font-mono-figure"
              />
            </div>
            <button type="button" onClick={() => onChange(items.filter((i) => i.id !== item.id))} aria-label="Remove" className="rounded-full p-1.5 text-ink-muted hover:bg-bg-soft hover:text-ink">
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => onChange([...items, newAccountRef()])} className="mt-1.5 flex items-center gap-1 text-[11.5px] text-rust hover:underline">
        <Plus size={12} /> Add {title.toLowerCase().replace(/s$/, '').replace('joint bank account', 'joint account')}
      </button>
      <p className="mt-1 text-[10.5px] text-ink-muted">Only the last 4 digits go in the folder name — keep full numbers in the Vault.</p>
    </div>
  )
}

function PreviewTree({ nodes, depth }: { nodes: PreviewNode[]; depth: number }) {
  return (
    <ul>
      {nodes.map((node, i) => (
        <li key={`${node.name}-${i}`}>
          <p className="flex items-center gap-1.5 py-[3px] text-[11.5px]" style={{ paddingLeft: depth * 14 }}>
            <Folder size={12} className={node.exists ? 'text-ink-muted' : 'text-rust'} />
            <span className={node.exists ? 'text-ink-muted' : 'text-ink'}>{node.name}</span>
            {node.exists && <span className="rounded-full bg-bg-soft px-1.5 text-[9.5px] uppercase tracking-wide text-ink-muted">exists</span>}
          </p>
          {node.children.length > 0 && <PreviewTree nodes={node.children} depth={depth + 1} />}
        </li>
      ))}
    </ul>
  )
}
