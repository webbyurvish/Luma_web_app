import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { serviceInText } from '@/lib/family'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeftRight,
  CalendarClock,
  CornerDownLeft,
  DatabaseBackup,
  FileText,
  HandCoins,
  KeyRound,
  Landmark,
  ListChecks,
  Lock,
  LogOut,
  NotebookText,
  PiggyBank,
  Plus,
  Receipt,
  ScanFace,
  Search,
  Sparkles,
  Undo2,
  Wallet,
  Gift,
  Smartphone,
  UserRound,
  ImageDown,
  type LucideIcon,
} from 'lucide-react'
import { QuickActionModal, type QuickActionKind } from '@/components/common/QuickActionModal'
import { navGroups, bottomNavItems } from '@/components/layout/navConfig'
import { useTransactions } from '@/hooks/useTransactions'
import { useAccounts } from '@/hooks/useFinanceCollections'
import { useBills } from '@/hooks/usePlanning'
import { useTasks, useUdhaar } from '@/hooks/useLifeCollections'
import { useNotes } from '@/hooks/useNotes'
import { useImportantDates, useRecharges } from '@/hooks/useFamily'
import { lockVault, useVault } from '@/hooks/useVault'
import { useToast } from '@/context/ToastContext'
import { getSnapshot, subscribe } from '@/lib/remoteStore'
import { clearAuthSession } from '@/lib/auth'
import { CATEGORY_META } from '@/lib/categoryMeta'
import { VAULT_TYPE_META } from '@/lib/vaultMeta'
import { formatCurrency } from '@/lib/formatCurrency'
import { formatDate, todayIstDateKey } from '@/lib/formatDate'
import { parseQuickAdd, type QuickAddDraft } from '@/services/googleSheetsApi'
import { cn } from '@/lib/cn'
import type { DriveTree } from '@/types'

interface PaletteItem {
  id: string
  group: string
  icon: LucideIcon
  title: string
  detail?: string
  /** Right-aligned hint (amount, date, shortcut). */
  meta?: string
  /** Higher sorts first within its group. */
  score: number
  run: () => void
}

const KIND_FOR_DRAFT: Record<string, QuickActionKind> = {
  expense: 'expense',
  income: 'income',
  transfer: 'transfer',
  udhaar_given: 'udhaar',
  udhaar_repayment: 'repayment',
  task: 'task',
}

/** 3 = starts with the query, 2 = a word starts with it, 1 = contains it, 0 = no match. */
function matchScore(text: string | undefined, q: string): number {
  if (!text) return 0
  const t = text.toLowerCase()
  if (t.startsWith(q)) return 3
  if (t.includes(' ' + q)) return 2
  return t.includes(q) ? 1 : 0
}

const best = (q: string, ...texts: (string | undefined)[]) => Math.max(0, ...texts.map((t) => matchScore(t, q)))

/** Looks like something to add ("450 swiggy upi", "gave rohit 2000"), not a search. */
const looksLikeEntry = (q: string) => /\d/.test(q) && q.trim().split(/\s+/).length >= 2

/** The heavy part of the palette, loaded the first time it opens (see CommandPaletteHost). */
export default function PaletteLayer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [editor, setEditor] = useState<{ kind: QuickActionKind; draft?: QuickAddDraft } | null>(null)
  return (
    <>
      {createPortal(<AnimatePresence>{open && <PaletteBody onClose={onClose} onAdd={(kind, draft) => setEditor({ kind, draft })} />}</AnimatePresence>, document.body)}
      <QuickActionModal open={editor !== null} kind={editor?.kind ?? 'expense'} draft={editor?.draft} onClose={() => setEditor(null)} />
    </>
  )
}

/** Mounted only while open, so its data hooks (notes etc.) load on first use, not at startup. */
function PaletteBody({ onClose, onAdd }: { onClose: () => void; onAdd: (kind: QuickActionKind, draft?: QuickAddDraft) => void }) {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [parsing, setParsing] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  const { transactions } = useTransactions()
  const { accounts } = useAccounts()
  const { bills } = useBills()
  const { people } = useUdhaar()
  const { tasks } = useTasks()
  const { notes } = useNotes()
  const { recharges } = useRecharges()
  const { dates: importantDates } = useImportantDates()
  const vault = useVault()
  const drive = useSyncExternalStore(
    (l) => subscribe('drive', l),
    () => getSnapshot('drive'),
  )

  const go = useCallback(
    (to: string, state?: Record<string, unknown>) => {
      onClose()
      navigate(to, state ? { state } : undefined)
    },
    [navigate, onClose],
  )
  const add = useCallback(
    (kind: QuickActionKind, draft?: QuickAddDraft) => {
      onClose()
      onAdd(kind, draft)
    },
    [onAdd, onClose],
  )

  const aiAdd = useCallback(
    async (text: string) => {
      setParsing(true)
      try {
        const draft = await parseQuickAdd(text, todayIstDateKey(), {
          categories: [...new Set([...Object.values(CATEGORY_META).map((m) => m.label), ...transactions.map((t) => t.rawCategory ?? '')].filter(Boolean))],
          paymentMethods: [...new Set(transactions.map((t) => t.payment).filter((p) => p && p !== 'Other'))],
          people: people.map((p) => p.name),
          accounts: accounts.filter((a) => a.isActive).map((a) => a.name),
        })
        if (draft.kind === 'unknown' || !KIND_FOR_DRAFT[draft.kind]) {
          showToast('Couldn\'t tell what to add. Try "450 Swiggy UPI" or "Gave Rohit 2000".', 'info')
          return
        }
        add(KIND_FOR_DRAFT[draft.kind], draft)
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Couldn't understand that.", 'error')
      } finally {
        setParsing(false)
      }
    },
    [accounts, add, people, showToast, transactions],
  )

  const items = useMemo<PaletteItem[]>(() => {
    const q = query.trim().toLowerCase()
    const out: PaletteItem[] = []
    const push = (item: Omit<PaletteItem, 'score'>, score: number) => score > 0 && out.push({ ...item, score })

    if (q && looksLikeEntry(q)) {
      out.push({ id: 'ai-add', group: 'Add', icon: Sparkles, title: `Add “${query.trim()}”`, detail: 'Luma fills in the form for you to check', score: 100, run: () => void aiAdd(query.trim()) })
    }

    const actions: [string, LucideIcon, QuickActionKind | (() => void), string?][] = [
      ['Add expense', Plus, 'expense'],
      ['Add income', Wallet, 'income'],
      ['Transfer between accounts', ArrowLeftRight, 'transfer'],
      ['Give udhaar', HandCoins, 'udhaar'],
      ['Record udhaar repayment', Undo2, 'repayment'],
      ['Add task', ListChecks, 'task'],
      ['Add bill', Receipt, () => go('/finance', { tab: 'bills' })],
      ['Upload document', FileText, () => go('/documents')],
      ...(vault.phase === 'unlocked' ? [['Lock vault', Lock, () => (lockVault(), onClose(), showToast('Vault locked'))] as [string, LucideIcon, () => void]] : []),
      [
        'Sign out',
        LogOut,
        () => {
          clearAuthSession()
          window.location.assign('/')
        },
      ],
    ]
    actions.forEach(([title, icon, act], i) =>
      push({ id: `act-${title}`, group: 'Actions', icon, title, run: typeof act === 'function' ? act : () => add(act) }, q ? best(q, title) : 50 - i),
    )

    const pages: [string, string, LucideIcon, Record<string, unknown>?][] = [
      ...[...navGroups.flatMap((g) => g.items), ...bottomNavItems].map((n) => [n.label, n.to, n.icon] as [string, string, LucideIcon]),
      ['Transactions', '/transactions', Receipt],
      ['Bills', '/finance', CalendarClock, { tab: 'bills' }],
      ['Budgets', '/finance', PiggyBank, { tab: 'budgets' }],
      ['Accounts', '/finance', Landmark, { tab: 'accounts' }],
      ['SIPs', '/finance', CalendarClock, { tab: 'sips' }],
      ['Backups and export', '/settings', DatabaseBackup, { tab: 'backups' }],
      ['Face ID sign-in', '/settings', ScanFace, { tab: 'security' }],
      ['Birthdays and dates', '/family', Gift, { tab: 'dates' }],
      ['Family recharges', '/family', Smartphone, { tab: 'recharges' }],
      ['Form kit', '/family', UserRound, { tab: 'formkit' }],
      ['Photo and signature resizer', '/family', ImageDown, { tab: 'resizer' }],
    ]
    pages.forEach(([title, to, icon, state]) =>
      push({ id: `page-${title}`, group: 'Go to', icon, title, meta: 'Page', run: () => go(to, state) }, q ? best(q, title) : 0),
    )

    if (q) {
      const amount = Number(q.replace(/[₹,\s]/g, ''))
      const byAmount = Number.isFinite(amount) && amount > 0
      transactions.forEach((t) => {
        const text = best(q, t.description, t.merchant, t.rawCategory, t.note, t.payment)
        const score = text || (byAmount && Math.round(t.amount) === Math.round(amount) ? 2 : 0)
        push(
          {
            id: `tx-${t.id}`,
            group: 'Transactions',
            icon: t.type === 'income' ? Wallet : Receipt,
            title: t.description || t.merchant || t.rawCategory || 'Transaction',
            detail: [t.rawCategory, t.payment !== 'Other' ? t.payment : '', formatDate(t.date)].filter(Boolean).join(' · '),
            meta: `${t.type === 'income' ? '+' : t.type === 'expense' ? '−' : ''}${formatCurrency(t.amount)}`,
            run: () => go('/transactions', { search: t.merchant || t.description || t.rawCategory || q }),
          },
          score,
        )
      })
      recharges.forEach((r) =>
        push(
          { id: `rch-${r.id}`, group: 'Family', icon: Smartphone, title: `${r.person}'s ${serviceInText(r.service)}`, detail: [r.provider, r.number, `expires ${formatDate(r.expiresOn)}`].filter(Boolean).join(' · '), meta: formatCurrency(r.amount), run: () => go('/family', { tab: 'recharges' }) },
          best(q, r.person, r.service, r.provider, r.number),
        ),
      )
      importantDates.forEach((d) =>
        push(
          { id: `date-${d.id}`, group: 'Family', icon: Gift, title: d.title || `${d.person}'s ${d.occasion.toLowerCase()}`, detail: formatDate(d.date.slice(0, 4) === '1900' ? `${new Date().getFullYear()}${d.date.slice(4)}` : d.date), run: () => go('/family', { tab: 'dates' }) },
          best(q, d.person, d.title, d.occasion),
        ),
      )
      bills.forEach((b) =>
        push(
          { id: `bill-${b.id}`, group: 'Bills', icon: CalendarClock, title: b.name, detail: `${b.frequency} · due ${formatDate(b.nextDueDate)}`, meta: formatCurrency(b.amount), run: () => go('/finance', { tab: 'bills' }) },
          best(q, b.name, b.category),
        ),
      )
      accounts.forEach((a) =>
        push(
          { id: `acc-${a.id}`, group: 'Accounts', icon: Landmark, title: a.name, detail: a.accountNumberLast4 ? `•• ${a.accountNumberLast4}` : a.institution, meta: formatCurrency(a.balance), run: () => go('/transactions', { accountId: a.id }) },
          best(q, a.name, a.institution),
        ),
      )
      people.forEach((p) =>
        push(
          { id: `udh-${p.name}`, group: 'Udhaar', icon: HandCoins, title: p.name, detail: p.outstanding > 0 ? `Owes you ${formatCurrency(p.outstanding)}` : p.outstanding < 0 ? `You owe ${formatCurrency(-p.outstanding)}` : 'Settled', run: () => go('/udhaar') },
          best(q, p.name),
        ),
      )
      tasks.forEach((t) =>
        push(
          { id: `task-${t.id}`, group: 'Tasks', icon: ListChecks, title: t.title, detail: [t.status, t.dueDate ? `due ${formatDate(t.dueDate)}` : ''].filter(Boolean).join(' · '), run: () => go('/tasks') },
          best(q, t.title, t.category, t.description),
        ),
      )
      notes.forEach((n) =>
        push(
          { id: `note-${n.id}`, group: 'Notes', icon: NotebookText, title: n.title, detail: n.content.slice(0, 80), run: () => go('/notes', { openId: n.id }) },
          Math.max(best(q, n.title, ...n.tags), matchScore(n.content, q) ? 1 : 0),
        ),
      )
      ;((drive.raw as DriveTree[] | null)?.[0]?.files ?? []).forEach((f) =>
        push({ id: `doc-${f.id}`, group: 'Documents', icon: FileText, title: f.name, detail: f.tags || undefined, run: () => go('/documents', { search: f.name }) }, best(q, f.name, f.tags, f.description)),
      )
      // Vault: names only, and only while it's unlocked — secrets never appear in search.
      if (vault.phase === 'unlocked')
        vault.items.forEach((v) =>
          push(
            { id: `vault-${v.id}`, group: 'Vault', icon: KeyRound, title: v.title, detail: VAULT_TYPE_META[v.type].label, run: () => go('/vault', { openId: v.id }) },
            best(q, v.title, v.group),
          ),
        )
    }

    const order = ['Add', 'Actions', 'Go to', 'Family', 'Transactions', 'Bills', 'Accounts', 'Udhaar', 'Tasks', 'Notes', 'Documents', 'Vault']
    const grouped = order.flatMap((g) =>
      out
        .filter((i) => i.group === g)
        .sort((a, b) => b.score - a.score)
        .slice(0, q ? (g === 'Transactions' ? 6 : 4) : g === 'Actions' ? 8 : 0),
    )
    return grouped
  }, [query, transactions, recharges, importantDates, bills, accounts, people, tasks, notes, drive, vault, aiAdd, add, go, onClose, showToast])

  useEffect(() => setActive(0), [query])
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(items.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      items[active]?.run()
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  let lastGroup = ''
  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center px-3 pt-[10vh]" onKeyDown={onKeyDown}>
      <motion.button
        aria-label="Close search"
        className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        role="dialog"
        aria-label="Search and commands"
        initial={{ opacity: 0, y: -8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.98 }}
        transition={{ duration: 0.15 }}
        className="relative w-full max-w-[600px] overflow-hidden rounded-hero border border-border bg-card shadow-hover"
      >
        <div className="flex items-center gap-3 border-b border-border-soft px-4">
          {parsing ? <Sparkles size={17} className="animate-pulse text-rust" /> : <Search size={17} className="text-ink-muted" />}
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search everything, or type “450 Swiggy UPI” to add"
            aria-label="Search"
            aria-activedescendant={items[active] ? `pal-${active}` : undefined}
            spellCheck={false}
            className="h-14 min-w-0 flex-1 bg-transparent text-[15px] text-ink placeholder:text-ink-muted focus:outline-none"
          />
          <kbd className="hidden shrink-0 rounded-xs border border-border px-1.5 py-0.5 font-mono-figure text-[10px] text-ink-muted sm:block">Esc</kbd>
        </div>

        <div ref={listRef} role="listbox" className="max-h-[min(60vh,440px)] overflow-y-auto py-1.5 pointer-coarse:max-h-[38vh]">
          {items.length === 0 ? (
            <p className="px-4 py-10 text-center text-xs text-ink-muted">Nothing found for “{query}”.</p>
          ) : (
            items.map((item, index) => {
              const header: ReactNode = item.group !== lastGroup ? <p className="px-4 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-muted">{item.group}</p> : null
              lastGroup = item.group
              const Icon = item.icon
              return (
                <div key={item.id}>
                  {header}
                  <button
                    id={`pal-${index}`}
                    data-index={index}
                    role="option"
                    aria-selected={index === active}
                    type="button"
                    onMouseMove={() => setActive(index)}
                    onClick={() => item.run()}
                    className={cn('flex w-full items-center gap-3 px-4 py-2 text-left', index === active ? 'bg-bg-soft' : '')}
                  >
                    <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', item.group === 'Add' ? 'bg-rust/10 text-rust' : 'bg-bg-soft text-ink-soft', index === active && item.group !== 'Add' && 'bg-card')}>
                      <Icon size={14} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-ink">{item.title}</span>
                      {item.detail && <span className="block truncate text-[11px] text-ink-muted">{item.detail}</span>}
                    </span>
                    {item.meta && <span className="shrink-0 font-mono-figure text-[11.5px] text-ink-soft">{item.meta}</span>}
                    {index === active && <CornerDownLeft size={13} className="shrink-0 text-ink-muted" />}
                  </button>
                </div>
              )
            })
          )}
        </div>

        <div className="hidden items-center gap-4 border-t border-border-soft px-4 py-2 text-[10.5px] text-ink-muted sm:flex">
          <span>↑↓ to move</span>
          <span>Enter to open</span>
          <span className="ml-auto flex items-center gap-1">
            Open anywhere with <kbd className="rounded-xs border border-border px-1 font-mono-figure">⌘K</kbd> or <kbd className="rounded-xs border border-border px-1 font-mono-figure">/</kbd>
          </span>
        </div>
      </motion.div>
    </div>
  )
}
