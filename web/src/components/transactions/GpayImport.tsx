import { useMemo, useRef, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, FileUp, History, Lock, ShieldCheck, Sparkles } from 'lucide-react'
import { SlideOver } from '@/components/ui/SlideOver'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { ThemedSelect } from '@/components/ui/ThemedSelect'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { AccountSelect } from '@/components/finance/AccountSelect'
import { accountsForMethod } from '@/lib/accountLinking'
import { CATEGORY_META } from '@/lib/categoryMeta'
import { formatCurrency } from '@/lib/formatCurrency'
import { formatDate } from '@/lib/formatDate'
import { getErrorMessage } from '@/lib/errors'
import { cn } from '@/lib/cn'
import { PdfPasswordError, readGpayStatement, type GpayRow, type GpayStatement } from '@/lib/gpayStatement'
import { bankKey, buildCategoryHistory, guessCategory, matchBankAccount, normalizeMerchant, rememberBankAccount, type CategorySource } from '@/lib/gpayImport'
import { importTransactions, type ImportResult } from '@/services/googleSheetsApi'
import type { FinancialAccount, Transaction } from '@/types'

type Duplicate = 'existing' | 'maybe' | null
type Filter = 'all' | 'needs' | 'duplicates'

interface Draft {
  include: boolean
  category: string
  subcategory: string
  note: string
  source: CategorySource
  /** The user set this row's category themselves. */
  touched: boolean
}

interface GpayImportProps {
  open: boolean
  onClose: () => void
  transactions: Transaction[]
  accounts: FinancialAccount[]
  /** month = the statement's last month (yyyy-MM), for the review link. */
  onImported: (result: ImportResult, month: string) => void
}

/** "BHARAT PETROLEUM CORPORATION" → "Bharat Petroleum Corporation"; mixed-case names stay as written. */
function tidyName(name: string): string {
  if (name !== name.toUpperCase()) return name
  return name.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase())
}

function bankLabel(row: Pick<GpayRow, 'bankName' | 'last4'>): string {
  if (!row.bankName && !row.last4) return 'Bank not shown'
  return row.last4 ? `${row.bankName || 'Account'} ••${row.last4}` : row.bankName
}

export function GpayImport({ open, onClose, transactions, accounts, onImported }: GpayImportProps) {
  const [phase, setPhase] = useState<'pick' | 'reading' | 'password' | 'review'>('pick')
  const [file, setFile] = useState<File | null>(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [statement, setStatement] = useState<GpayStatement | null>(null)
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [bankAccounts, setBankAccounts] = useState<Record<string, string>>({})
  const [filter, setFilter] = useState<Filter>('all')
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState('')
  const [confirmClose, setConfirmClose] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const reset = () => {
    setPhase('pick')
    setFile(null)
    setPassword('')
    setError('')
    setStatement(null)
    setDrafts({})
    setFilter('all')
    setProgress('')
  }

  const close = () => {
    reset()
    onClose()
  }
  const requestClose = () => (phase === 'review' ? setConfirmClose(true) : close())

  const knownRefs = useMemo(() => new Set(transactions.map((t) => t.reference).filter(Boolean)), [transactions])
  const duplicates = useMemo(() => {
    const out: Record<string, Duplicate> = {}
    for (const row of statement?.rows ?? []) {
      if (row.reference && knownRefs.has(row.reference)) out[row.key] = 'existing'
      else {
        const type = row.direction === 'credit' ? 'income' : 'expense'
        // Probably typed in by hand already: same day, same amount, no statement reference.
        const twin = transactions.some((t) => !t.reference && t.date === row.date && t.type === type && Math.abs(t.amount - row.amount) < 0.01)
        out[row.key] = twin ? 'maybe' : null
      }
    }
    return out
  }, [statement, knownRefs, transactions])

  const load = async (picked: File, pass?: string) => {
    setPhase('reading')
    setError('')
    try {
      const parsed = await readGpayStatement(picked, pass)
      if (!parsed.rows.length) {
        setError("Couldn't find any payments in this PDF. Make sure it's the transaction statement downloaded from Google Pay.")
        setPhase('pick')
        return
      }
      const history = buildCategoryHistory(transactions)
      const refs = new Set(transactions.map((t) => t.reference).filter(Boolean))
      const next: Record<string, Draft> = {}
      for (const row of parsed.rows) {
        const guess = guessCategory(row, history)
        const sameDay = transactions.some(
          (t) => !t.reference && t.date === row.date && t.type === (row.direction === 'credit' ? 'income' : 'expense') && Math.abs(t.amount - row.amount) < 0.01,
        )
        next[row.key] = {
          include: row.direction !== 'self' && !refs.has(row.reference) && !sameDay,
          category: guess.category,
          subcategory: guess.subcategory,
          note: '',
          source: guess.source,
          touched: false,
        }
      }
      const banks: Record<string, string> = {}
      for (const row of parsed.rows) {
        const key = bankKey(row)
        if (!(key in banks)) banks[key] = matchBankAccount(accounts, row.bankName, row.last4)
      }
      setStatement({ ...parsed, rows: [...parsed.rows].sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1)) })
      setDrafts(next)
      setBankAccounts(banks)
      setPhase('review')
    } catch (err) {
      if (err instanceof PdfPasswordError) {
        setError(err.wrong ? err.message : '')
        setPhase('password')
        return
      }
      setError(getErrorMessage(err, "Couldn't read this PDF."))
      setPhase('pick')
    }
  }

  const pick = (picked: File | undefined) => {
    if (!picked) return
    if (picked.type && picked.type !== 'application/pdf') {
      setError('Choose the PDF statement from Google Pay.')
      return
    }
    setFile(picked)
    void load(picked)
  }

  const rows = useMemo(() => statement?.rows ?? [], [statement])
  const banks = useMemo(() => {
    const seen = new Map<string, { row: GpayRow; count: number }>()
    rows.forEach((row) => {
      const key = bankKey(row)
      const entry = seen.get(key)
      if (entry) entry.count++
      else seen.set(key, { row, count: 1 })
    })
    return [...seen.entries()].map(([key, v]) => ({ key, label: bankLabel(v.row), count: v.count }))
  }, [rows])

  const updateDraft = (key: string, patch: Partial<Draft>) => setDrafts((d) => ({ ...d, [key]: { ...d[key], ...patch } }))

  // Picking a category also fills the other payments to the same payee that weren't set by hand.
  const setCategory = (row: GpayRow, category: string, subcategory?: string) => {
    const payee = normalizeMerchant(row.payee)
    setDrafts((d) => {
      const next = { ...d, [row.key]: { ...d[row.key], category, ...(subcategory !== undefined ? { subcategory } : {}), touched: true } }
      rows.forEach((other) => {
        if (other.key === row.key || other.direction !== row.direction || next[other.key].touched) return
        if (normalizeMerchant(other.payee) !== payee) return
        next[other.key] = { ...next[other.key], category, ...(subcategory !== undefined ? { subcategory } : {}) }
      })
      return next
    })
  }

  const categoryOptions = useMemo(() => {
    const values = new Set<string>([...Object.values(CATEGORY_META).map((m) => m.label), ...transactions.map((t) => t.rawCategory ?? ''), ...Object.values(drafts).map((d) => d.category)])
    values.delete('')
    values.delete('Udhaar')
    values.delete('Transfer')
    return [...values].sort((a, b) => a.localeCompare(b)).map((value) => ({ value, label: value }))
  }, [transactions, drafts])

  const subcategoriesFor = useMemo(() => {
    const map = new Map<string, Set<string>>()
    transactions.forEach((t) => {
      if (!t.rawCategory || !t.rawSubcategory) return
      if (!map.has(t.rawCategory)) map.set(t.rawCategory, new Set())
      map.get(t.rawCategory)!.add(t.rawSubcategory)
    })
    return map
  }, [transactions])

  const selectable = (row: GpayRow) => row.direction !== 'self' && duplicates[row.key] !== 'existing'
  const chosen = rows.filter((r) => selectable(r) && drafts[r.key]?.include)
  const missingCategory = chosen.filter((r) => !drafts[r.key].category.trim())
  const totals = chosen.reduce((acc, r) => (r.direction === 'credit' ? { ...acc, in: acc.in + r.amount } : { ...acc, out: acc.out + r.amount }), { in: 0, out: 0 })
  const counts = {
    all: rows.length,
    needs: rows.filter((r) => selectable(r) && !drafts[r.key]?.category.trim()).length,
    duplicates: rows.filter((r) => duplicates[r.key]).length,
  }
  const visible = rows.filter((r) =>
    filter === 'needs' ? selectable(r) && !drafts[r.key]?.category.trim() : filter === 'duplicates' ? !!duplicates[r.key] : true,
  )
  const allVisibleOn = visible.filter(selectable).every((r) => drafts[r.key]?.include)

  const runImport = async () => {
    if (!chosen.length || missingCategory.length) return
    setImporting(true)
    setProgress('')
    try {
      const result = await importTransactions(
        chosen.map((r) => {
          const d = drafts[r.key]
          return {
            date: r.date,
            time: r.time,
            amount: r.amount,
            type: r.direction === 'credit' ? 'Income' : 'Expense',
            category: d.category.trim(),
            subcategory: d.subcategory.trim(),
            paymentMethod: 'UPI',
            merchant: tidyName(r.payee),
            note: d.note.trim(),
            accountId: bankAccounts[bankKey(r)] ?? '',
            reference: r.reference,
          }
        }),
        'Google Pay',
        (done, total) => setProgress(`${done} of ${total} saved…`),
      )
      onImported(result, (statement?.to ?? '').slice(0, 7))
      close()
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't import the payments."))
    } finally {
      setImporting(false)
    }
  }

  const { suggested, others } = accountsForMethod(accounts, 'UPI')

  return (
    <>
      <SlideOver
        open={open}
        onClose={requestClose}
        title="Import Google Pay"
        subtitle={
          statement
            ? `${rows.length} payments · ${formatDate(statement.from)} – ${formatDate(statement.to)}`
            : 'Add payments from your Google Pay statement'
        }
        className="sm:w-[560px] md:w-[640px]"
        busy={importing}
        busyLabel={progress || 'Saving payments to your ledger…'}
        footer={
          phase === 'review' ? (
            <div className="flex flex-col gap-2">
              {error && <p className="text-xs text-danger">{error}</p>}
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 text-[11px] leading-tight text-ink-soft">
                  <p className="font-semibold text-ink">{chosen.length} selected</p>
                  <p className="truncate">
                    {totals.out > 0 && <span className="text-danger">−{formatCurrency(totals.out, { exact: true })}</span>}
                    {totals.out > 0 && totals.in > 0 && ' · '}
                    {totals.in > 0 && <span className="text-success">+{formatCurrency(totals.in, { exact: true })}</span>}
                    {missingCategory.length > 0 && <span className="text-warning"> · {missingCategory.length} need a category</span>}
                  </p>
                </div>
                <Button onClick={runImport} loading={importing} loadingText="Importing…" disabled={!chosen.length || missingCategory.length > 0}>
                  Import {chosen.length || ''}
                </Button>
              </div>
            </div>
          ) : undefined
        }
      >
        {phase !== 'review' ? (
          <div className="flex flex-col gap-4">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={phase === 'reading'}
              className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border bg-bg-soft/50 px-4 py-8 text-center transition-colors hover:border-rust/60 hover:bg-bg-soft disabled:opacity-60"
            >
              <span className="grid size-11 place-items-center rounded-full bg-rust-soft text-rust">
                <FileUp size={20} />
              </span>
              <span className="text-sm font-semibold text-ink">{phase === 'reading' ? 'Reading statement…' : file ? 'Choose another PDF' : 'Choose statement PDF'}</span>
              <span className="text-xs text-ink-soft">{file ? file.name : 'The PDF you downloaded from Google Pay'}</span>
            </button>
            <input ref={fileInput} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => (pick(e.target.files?.[0]), (e.target.value = ''))} />

            {phase === 'password' && file && (
              <form
                className="flex flex-col gap-2 rounded-md border border-border p-3"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (password) void load(file, password)
                }}
              >
                <p className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                  <Lock size={13} /> This PDF is password-protected
                </p>
                <Input type="password" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="PDF password" autoFocus />
                <Button type="submit" size="sm" disabled={!password}>
                  Open
                </Button>
              </form>
            )}

            {error && <p className="text-xs text-danger">{error}</p>}

            <div className="rounded-md border border-border-soft p-3 text-xs leading-relaxed text-ink-soft">
              <p className="mb-1.5 font-semibold text-ink">Getting the statement</p>
              <ol className="list-decimal space-y-0.5 pl-4">
                <li>Open Google Pay and tap your profile picture.</li>
                <li>Open your payment history and tap the download / statement option.</li>
                <li>Pick the months you want and save the PDF to Files.</li>
              </ol>
              <p className="mt-1.5 text-[11px]">Menu names can differ a little between app versions.</p>
            </div>
            <p className="flex items-start gap-1.5 text-[11px] leading-snug text-ink-muted">
              <ShieldCheck size={13} className="mt-px shrink-0 text-success" />
              The PDF is read on this device and never uploaded. Only the payments you confirm are saved to your sheet.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <section className="flex flex-col gap-3 rounded-md border border-border-soft p-3">
              <div>
                <p className="text-xs font-semibold text-ink">Which account is it?</p>
                <p className="text-[11px] text-ink-soft">Balances of linked accounts update with the import. Luma remembers your choice.</p>
              </div>
              {banks.map((b) => (
                <AccountSelect
                  key={b.key}
                  label={`${b.label} · ${b.count} payment${b.count === 1 ? '' : 's'}`}
                  value={bankAccounts[b.key] ?? ''}
                  onChange={(id) => {
                    setBankAccounts((m) => ({ ...m, [b.key]: id }))
                    rememberBankAccount(b.key, id)
                  }}
                  suggested={suggested}
                  others={others}
                />
              ))}
            </section>

            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  ['all', 'All'],
                  ['needs', 'Needs category'],
                  ['duplicates', 'Duplicates'],
                ] as [Filter, string][]
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={cn(
                    'h-7 rounded-full border px-2.5 text-[11px] font-medium transition-colors pointer-coarse:h-8',
                    filter === value ? 'border-rust bg-rust-soft text-rust' : 'border-border text-ink-soft hover:bg-bg-soft',
                  )}
                >
                  {label} {counts[value]}
                </button>
              ))}
              {visible.some(selectable) && (
                <button
                  type="button"
                  className="ml-auto text-[11px] font-medium text-rust hover:underline"
                  onClick={() => visible.filter(selectable).forEach((r) => updateDraft(r.key, { include: !allVisibleOn }))}
                >
                  {allVisibleOn ? 'Clear all' : 'Select all'}
                </button>
              )}
            </div>

            {visible.length === 0 && <p className="py-6 text-center text-xs text-ink-soft">Nothing here.</p>}

            <ul className="flex flex-col gap-2.5">
              {visible.map((row) => (
                <ImportRow
                  key={row.key}
                  row={row}
                  draft={drafts[row.key]}
                  duplicate={duplicates[row.key]}
                  selectable={selectable(row)}
                  categoryOptions={categoryOptions}
                  subcategories={[...(subcategoriesFor.get(drafts[row.key]?.category) ?? [])]}
                  bank={banks.length > 1 ? bankLabel(row) : ''}
                  onToggle={(include) => updateDraft(row.key, { include })}
                  onCategory={(category) => setCategory(row, category, category === drafts[row.key].category ? undefined : '')}
                  onSubcategory={(subcategory) => setCategory(row, drafts[row.key].category, subcategory)}
                  onNote={(note) => updateDraft(row.key, { note })}
                />
              ))}
            </ul>
          </div>
        )}
      </SlideOver>

      <ConfirmDialog
        open={confirmClose}
        title="Leave the import?"
        description="Nothing has been saved yet. Your categories and remarks for this statement will be lost."
        confirmLabel="Leave"
        onConfirm={() => {
          setConfirmClose(false)
          close()
        }}
        onCancel={() => setConfirmClose(false)}
      />
    </>
  )
}

interface ImportRowProps {
  row: GpayRow
  draft: Draft
  duplicate: Duplicate
  selectable: boolean
  categoryOptions: { value: string; label: string }[]
  subcategories: string[]
  bank: string
  onToggle: (include: boolean) => void
  onCategory: (category: string) => void
  onSubcategory: (subcategory: string) => void
  onNote: (note: string) => void
}

function ImportRow({ row, draft, duplicate, selectable, categoryOptions, subcategories, bank, onToggle, onCategory, onSubcategory, onNote }: ImportRowProps) {
  const credit = row.direction === 'credit'
  const listId = `gpay-sub-${row.key}`
  const on = selectable && draft.include
  return (
    <li className={cn('rounded-md border p-3 transition-colors', on ? 'border-border bg-card' : 'border-border-soft bg-bg-soft/40')}>
      <label className={cn('flex items-start gap-3', selectable ? 'cursor-pointer' : 'cursor-default')}>
        <input
          type="checkbox"
          className="mt-1 size-4 shrink-0 accent-[var(--color-rust)]"
          checked={on}
          disabled={!selectable}
          onChange={(e) => onToggle(e.target.checked)}
          aria-label={`Import ${row.payee}`}
        />
        <span className={cn('mt-0.5 grid size-7 shrink-0 place-items-center rounded-full', credit ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger')}>
          {credit ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <span className={cn('min-w-0 break-words text-sm font-semibold leading-snug', on ? 'text-ink' : 'text-ink-soft')}>{tidyName(row.payee)}</span>
            <span className={cn('shrink-0 text-sm font-semibold tabular-nums', credit ? 'text-success' : 'text-ink')}>
              {credit ? '+' : '−'}
              {formatCurrency(row.amount, { exact: true })}
            </span>
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-ink-soft">
            <span>
              {formatDate(row.date)}
              {row.time && ` · ${row.time}`}
            </span>
            {bank && <span className="text-ink-muted">· {bank}</span>}
            {duplicate === 'existing' && <Badge variant="neutral">Already in Luma</Badge>}
            {duplicate === 'maybe' && <Badge variant="warning">Maybe added by hand</Badge>}
            {row.direction === 'self' && <Badge variant="neutral">Own account transfer</Badge>}
            {selectable && draft.source === 'history' && !draft.touched && (
              <Badge variant="success">
                <History size={10} /> Your usual
              </Badge>
            )}
            {selectable && draft.source === 'rule' && !draft.touched && (
              <Badge variant="ai">
                <Sparkles size={10} /> Suggested
              </Badge>
            )}
          </span>
        </span>
      </label>

      {row.direction === 'self' && <p className="mt-2 pl-[3.25rem] text-[11px] text-ink-muted">Moves money between your own accounts — add it as a transfer if you track both.</p>}

      {on && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:pl-[3.25rem]">
          <ThemedSelect value={draft.category} options={categoryOptions} placeholder="Choose category" onChange={onCategory} aria-label="Category" />
          <div>
            <Input list={listId} value={draft.subcategory} onChange={(e) => onSubcategory(e.target.value)} placeholder="Subcategory" aria-label="Subcategory" />
            <datalist id={listId}>
              {subcategories.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div className="col-span-2">
            <Input value={draft.note} onChange={(e) => onNote(e.target.value)} placeholder="Remark — where / what for (optional)" aria-label="Remark" maxLength={500} />
          </div>
        </div>
      )}
    </li>
  )
}
