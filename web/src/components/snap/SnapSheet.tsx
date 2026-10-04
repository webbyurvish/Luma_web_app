import { useId, useMemo, useRef, useState } from 'react'
import { Camera, ImagePlus, RotateCcw, ScanText, ShieldCheck } from 'lucide-react'
import { SlideOver } from '@/components/ui/SlideOver'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Switch } from '@/components/ui/Switch'
import { AccountSelect } from '@/components/finance/AccountSelect'
import { Chips, Field, RecordExpense } from '@/components/life/FormBits'
import { useToast } from '@/context/ToastContext'
import { useTransactions } from '@/hooks/useTransactions'
import { useAccounts } from '@/hooks/useFinanceCollections'
import { useBills } from '@/hooks/usePlanning'
import { useTasks } from '@/hooks/useLifeCollections'
import { useNotes } from '@/hooks/useNotes'
import { useKnownPeople, useMedicalBills } from '@/hooks/useLife'
import { readSnap } from '@/services/googleSheetsApi'
import { uploadToFamilyFolder } from '@/lib/driveUpload'
import { accountsForMethod, defaultAccountFor } from '@/lib/accountLinking'
import { CATEGORY_META } from '@/lib/categoryMeta'
import { kindForPayee } from '@/lib/medical'
import { KEEP_PHOTO_BY_DEFAULT, SNAP_KINDS, contactText, isoOrEmpty, prescriptionText, shrinkPhoto, type SnapKind, type SnapResult } from '@/lib/snap'
import { formatCurrency } from '@/lib/formatCurrency'
import { formatDate, todayIstDateKey } from '@/lib/formatDate'
import { getErrorMessage } from '@/lib/errors'
import { cn } from '@/lib/cn'
import type { BillFrequency } from '@/types'

type Kind = Exclude<SnapKind, 'unreadable'>

interface Draft {
  kind: Kind
  title: string
  amount: string
  date: string
  dueDate: string
  expiryDate: string
  category: string
  person: string
  merchant: string
  reference: string
  body: string
  frequency: BillFrequency
  keepPhoto: boolean
  recordExpense: boolean
  accountId: string
}

const FREQUENCIES: BillFrequency[] = ['Monthly', 'Quarterly', 'Yearly', 'One-time']
const KIND_LABEL = Object.fromEntries(SNAP_KINDS.map((k) => [k.kind, k.label])) as Record<Kind, string>

/** Which sub-folder of the person's folder a kept photo goes into. */
function areaFor(kind: Kind, title: string): RegExp | undefined {
  if (kind === 'medical_bill' || kind === 'prescription') return /health/i
  const t = title.toLowerCase()
  if (/insur|policy|mediclaim/.test(t)) return /insurance/i
  if (/\bpuc\b|\brc\b|vehicle|car|bike|scooter|driving/.test(t)) return /vehicle/i
  if (/aadhaar|pan\b|passport|voter|licen[cs]e|\bid\b/.test(t)) return /identity|id/i
  if (/rent|property|electric|gas|water|society/.test(t)) return /property|home/i
  return undefined
}

function toDraft(r: SnapResult, today: string, accountId: string): Draft {
  const kind: Kind = r.kind === 'unreadable' ? 'note' : r.kind
  const body = kind === 'prescription' ? prescriptionText(r) : kind === 'contact' ? contactText(r) : r.text ?? r.summary ?? ''
  return {
    kind,
    title: (kind === 'contact' ? r.contactName : r.title) || r.merchant || '',
    amount: r.amount !== null && r.amount !== undefined ? String(r.amount) : '',
    date: isoOrEmpty(r.date) || today,
    dueDate: isoOrEmpty(r.dueDate),
    expiryDate: isoOrEmpty(r.expiryDate),
    category: r.category || (kind === 'bill' ? 'Bills' : kind === 'medical_bill' ? 'Health' : ''),
    person: r.person || '',
    merchant: r.merchant || '',
    reference: r.reference || '',
    body,
    frequency: 'Monthly',
    keepPhoto: KEEP_PHOTO_BY_DEFAULT.has(kind),
    recordExpense: false,
    accountId,
  }
}

export default function SnapSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { showToast } = useToast()
  const today = todayIstDateKey()
  const peopleId = useId()
  const cameraInput = useRef<HTMLInputElement>(null)
  const libraryInput = useRef<HTMLInputElement>(null)
  const { transactions, createTransaction } = useTransactions()
  const { accounts } = useAccounts()
  const { createBill } = useBills()
  const { createTask } = useTasks()
  const { createNote } = useNotes()
  const { createBill: createMedicalBill } = useMedicalBills()
  const people = useKnownPeople()

  const [phase, setPhase] = useState<'pick' | 'reading' | 'review'>('pick')
  const [preview, setPreview] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [result, setResult] = useState<SnapResult | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const categories = useMemo(
    () => [...new Set([...Object.values(CATEGORY_META).map((m) => m.label), ...transactions.map((t) => t.rawCategory ?? '')].filter(Boolean))].sort(),
    [transactions],
  )

  const reset = () => {
    setPhase('pick')
    setPreview('')
    setPhoto(null)
    setResult(null)
    setDraft(null)
    setError('')
  }
  const close = () => {
    if (saving) return
    reset()
    onClose()
  }

  const read = async (file: File | undefined) => {
    if (!file) return
    setError('')
    setPhase('reading')
    try {
      const small = await shrinkPhoto(file)
      setPreview(small.dataUrl)
      setPhoto(small.file)
      const r = await readSnap<SnapResult>(small.dataUrl, today, { people, categories: categories.slice(0, 40) })
      setResult(r)
      if (r.kind === 'unreadable') {
        setError("Luma couldn't make that out. Try again in better light, with the whole paper in the frame.")
        setPhase('pick')
        return
      }
      setDraft(toDraft(r, today, defaultAccountFor(accounts, 'UPI')))
      setPhase('review')
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't read that photo."))
      setPhase('pick')
    }
  }

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d))
  const switchKind = (kind: Kind) => {
    if (!draft || !result) return
    const next = toDraft({ ...result, kind }, today, draft.accountId)
    // Keep what the user already typed in the shared fields.
    setDraft({ ...next, title: draft.title || next.title, amount: draft.amount || next.amount, person: draft.person, merchant: draft.merchant || next.merchant, keepPhoto: KEEP_PHOTO_BY_DEFAULT.has(kind) })
  }

  const amount = Number(draft?.amount)
  const needs = (() => {
    if (!draft) return ''
    const k = draft.kind
    if (!draft.title.trim() && !['medical_bill', 'prescription'].includes(k)) return k === 'contact' ? 'Add the name.' : 'Add a title.'
    if ((k === 'bill' || k === 'expense' || k === 'medical_bill') && !(amount > 0)) return 'Add the amount.'
    if (k === 'bill' && !draft.dueDate) return 'Add the due date.'
    if (k === 'event' && !draft.dueDate) return 'Add the date.'
    if ((k === 'medical_bill' || k === 'prescription') && !draft.person.trim()) return 'Who is it for?'
    return ''
  })()

  const save = async () => {
    if (!draft || needs) return
    setSaving(true)
    const d = draft
    const title = d.title.trim() || d.merchant.trim() || KIND_LABEL[d.kind]
    try {
      let kept: { id: string; url: string; folderName: string } | null = null
      if (photo && (d.kind === 'document' || d.keepPhoto)) {
        kept = await uploadToFamilyFolder(photo, {
          person: d.person.trim() || undefined,
          area: areaFor(d.kind, title),
          name: `${d.date || today} ${d.person ? d.person + ' ' : ''}${title}`,
          description: result?.summary ?? '',
          tags: d.kind.replace('_', ' '),
          expiryDate: d.kind === 'document' ? d.expiryDate || undefined : undefined,
        })
      }
      const photoLine = kept ? `\nPhoto: ${kept.url}` : ''
      let message = ''
      switch (d.kind) {
        case 'bill':
          await createBill({ name: title, amount, category: d.category || 'Bills', paymentMethod: 'UPI', accountId: '', frequency: d.frequency, nextDueDate: d.dueDate, remindDaysBefore: 3, isActive: true, notes: [d.reference && `No. ${d.reference}`, kept && `Photo: ${kept.url}`].filter(Boolean).join(' · ') })
          message = `Bill reminder added — due ${formatDate(d.dueDate)}`
          break
        case 'expense':
          await createTransaction({ date: d.date, amount, type: 'Expense', category: d.category || 'Other', subcategory: result?.subcategory ?? '', paymentMethod: result?.paymentMethod || 'UPI', merchant: d.merchant || title, note: d.body.slice(0, 200), accountId: d.accountId })
          message = `${formatCurrency(amount)} expense added`
          break
        case 'medical_bill':
          await createMedicalBill({ person: d.person.trim(), date: d.date, kind: kindForPayee(d.merchant || title), provider: d.merchant || title, amount, transactionId: '', claimStatus: 'Not claimed', insurer: '', claimNumber: '', claimedAmount: null, reimbursedAmount: null, driveFileId: kept?.id ?? '', fileUrl: kept?.url ?? '', notes: '' })
          if (d.recordExpense) await createTransaction({ date: d.date, amount, type: 'Expense', category: 'Health', subcategory: kindForPayee(d.merchant || title), paymentMethod: 'UPI', merchant: d.merchant || title, note: d.person.trim(), accountId: d.accountId })
          message = `Saved to ${d.person.trim()}'s health bills`
          break
        case 'prescription':
          await createNote({ title: `Prescription · ${d.person.trim()} · ${d.merchant || 'Doctor'} · ${formatDate(d.date)}`, content: d.body + photoLine, category: 'personal', tags: ['prescription', d.person.trim()].filter(Boolean) })
          message = `Prescription saved in Notes${kept ? ` and ${kept.folderName}` : ''}`
          break
        case 'event':
          await createTask({ title, description: [result?.summary, d.body !== result?.summary ? d.body : ''].filter(Boolean).join('\n').slice(0, 500) + photoLine, dueDate: d.dueDate, priority: 'medium', status: 'Todo', category: 'Personal' })
          message = `Added to tasks for ${formatDate(d.dueDate)}`
          break
        case 'document':
          message = `Saved in ${kept?.folderName ?? 'Documents'}${d.expiryDate ? ` — reminder before ${formatDate(d.expiryDate)}` : ''}`
          break
        case 'contact':
          await createNote({ title, content: d.body + photoLine, category: 'contacts', tags: ['contact'] })
          message = `${title} saved in Notes → Contacts`
          break
        case 'note':
          await createNote({ title, content: d.body + photoLine, category: 'personal', tags: ['snap'] })
          message = 'Saved as a note'
          break
      }
      showToast(message)
      reset()
      onClose()
    } catch (err) {
      showToast(getErrorMessage(err, "Couldn't save it."), 'error')
    } finally {
      setSaving(false)
    }
  }

  const action = draft ? SNAP_KINDS.find((k) => k.kind === draft.kind)?.action ?? 'Save' : 'Save'
  const { suggested, others } = accountsForMethod(accounts, 'UPI')
  const k = draft?.kind

  return (
    <SlideOver
      open={open}
      onClose={close}
      title="Snap & file"
      subtitle={phase === 'review' && result?.summary ? result.summary : 'Photo of any paper — Luma reads it and files it'}
      busy={saving}
      busyLabel="Saving…"
      footer={
        phase === 'review' && draft ? (
          <div className="flex items-center justify-between gap-3">
            <Button variant="ghost" size="sm" icon={<RotateCcw size={13} />} onClick={reset}>
              Retake
            </Button>
            <div className="flex min-w-0 items-center gap-2">
              {needs && <p className="truncate text-[11px] text-warning">{needs}</p>}
              <Button onClick={() => void save()} disabled={!!needs} loading={saving} loadingText="Saving…">
                {action}
              </Button>
            </div>
          </div>
        ) : undefined
      }
    >
      {phase !== 'review' || !draft ? (
        <div className="flex flex-col gap-4">
          {phase === 'reading' ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              {preview ? <img src={preview} alt="" className="max-h-56 rounded-md border border-border object-contain shadow-card" /> : <div className="h-40 w-32 animate-pulse rounded-md bg-bg-soft" />}
              <p className="flex items-center gap-2 text-sm font-medium text-ink">
                <ScanText size={16} className="animate-spark text-rust" /> Reading it…
              </p>
              <p className="text-[11px] text-ink-muted">Usually 5–10 seconds</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => cameraInput.current?.click()}
                  className="flex flex-col items-center gap-2 rounded-card bg-hero px-3 py-7 text-hero-ink shadow-hero transition-transform active:scale-[0.98]"
                >
                  <Camera size={26} className="text-amber" />
                  <span className="text-sm font-semibold">Take photo</span>
                </button>
                <button
                  type="button"
                  onClick={() => libraryInput.current?.click()}
                  className="flex flex-col items-center gap-2 rounded-card border border-border bg-card px-3 py-7 text-ink transition-colors hover:bg-bg-soft"
                >
                  <ImagePlus size={26} className="text-rust" />
                  <span className="text-sm font-semibold">Choose photo</span>
                </button>
              </div>
              <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                void read(file)
              }} />
              <input ref={libraryInput} type="file" accept="image/*" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                void read(file)
              }} />
              {error && <p className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{error}</p>}
              <div className="rounded-md border border-border-soft p-3 text-xs leading-relaxed text-ink-soft">
                <p className="mb-1 font-semibold text-ink">Works with</p>
                <p>Electricity, gas and phone bills · shop and fuel receipts · payment screenshots · pharmacy and hospital bills · prescriptions · invitations and school notices · warranty cards and policies · visiting cards.</p>
              </div>
              <p className="flex items-start gap-1.5 text-[11px] leading-snug text-ink-muted">
                <ShieldCheck size={13} className="mt-px shrink-0 text-success" />
                The photo is read by your own Azure AI and nothing is saved until you tap save. Don't snap card numbers or passwords — those belong in the Vault.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            {preview && <img src={preview} alt="The photo" className="h-24 w-20 shrink-0 rounded-md border border-border object-cover" />}
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Looks like</p>
              <p className="font-display text-lg italic text-ink">{KIND_LABEL[draft.kind]}</p>
              {result && result.confidence < 0.6 && <p className="text-[11px] text-warning">Not fully sure — check the details below.</p>}
            </div>
          </div>

          <Field label="File it as">
            <Chips value={draft.kind} options={SNAP_KINDS.map((s) => s.kind)} labels={KIND_LABEL} onChange={switchKind} />
          </Field>

          {k !== 'medical_bill' && k !== 'prescription' && (
            <Field label={k === 'contact' ? 'Name' : k === 'bill' ? 'Bill name' : k === 'expense' ? 'Paid to' : 'Title'}>
              <Input value={draft.title} onChange={(e) => set('title', e.target.value)} />
            </Field>
          )}

          {(k === 'medical_bill' || k === 'prescription' || k === 'document') && (
            <div className="grid grid-cols-2 gap-3">
              <Field label={k === 'document' ? 'Whose (optional)' : 'For'}>
                <Input list={peopleId} value={draft.person} onChange={(e) => set('person', e.target.value)} placeholder="Me, Mom, Dad…" />
                <datalist id={peopleId}>
                  {people.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </Field>
              {k !== 'document' ? (
                <Field label={k === 'prescription' ? 'Doctor' : 'Doctor / hospital / shop'}>
                  <Input value={draft.merchant} onChange={(e) => set('merchant', e.target.value)} />
                </Field>
              ) : (
                <Field label="Valid till (optional)">
                  <Input type="date" value={draft.expiryDate} onChange={(e) => set('expiryDate', e.target.value)} />
                </Field>
              )}
            </div>
          )}

          {(k === 'bill' || k === 'expense' || k === 'medical_bill') && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount (₹)">
                <Input value={draft.amount} onChange={(e) => set('amount', e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" className="font-mono-figure" />
              </Field>
              {k === 'bill' ? (
                <Field label="Due on">
                  <Input type="date" value={draft.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
                </Field>
              ) : (
                <Field label="Date">
                  <Input type="date" value={draft.date} onChange={(e) => set('date', e.target.value)} />
                </Field>
              )}
            </div>
          )}

          {k === 'event' && (
            <Field label="On">
              <Input type="date" value={draft.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
            </Field>
          )}
          {k === 'prescription' && (
            <Field label="Date">
              <Input type="date" value={draft.date} onChange={(e) => set('date', e.target.value)} />
            </Field>
          )}

          {k === 'bill' && (
            <>
              <Field label="Repeats">
                <Chips value={draft.frequency} options={FREQUENCIES} onChange={(v) => set('frequency', v)} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Category">
                  <Input value={draft.category} onChange={(e) => set('category', e.target.value)} />
                </Field>
                <Field label="Consumer / bill no.">
                  <Input value={draft.reference} onChange={(e) => set('reference', e.target.value)} className="font-mono-figure" />
                </Field>
              </div>
            </>
          )}

          {k === 'expense' && (
            <>
              <Field label="Category">
                <Input list={`${peopleId}-cat`} value={draft.category} onChange={(e) => set('category', e.target.value)} />
                <datalist id={`${peopleId}-cat`}>
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
              <AccountSelect label="Paid from" value={draft.accountId} onChange={(id) => set('accountId', id)} suggested={suggested} others={others} />
            </>
          )}

          {(k === 'prescription' || k === 'contact' || k === 'note' || k === 'event' || k === 'document') && (
            <Field label={k === 'prescription' ? 'Medicines' : k === 'contact' ? 'Details' : 'Notes'}>
              <textarea
                value={draft.body}
                onChange={(e) => set('body', e.target.value)}
                rows={k === 'prescription' ? 6 : 4}
                className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-xs leading-relaxed text-ink placeholder:text-ink-muted focus:border-rust focus:outline-none"
              />
            </Field>
          )}

          {k === 'medical_bill' && amount > 0 && (
            <RecordExpense on={draft.recordExpense} onToggle={(v) => set('recordExpense', v)} accountId={draft.accountId} onAccount={(id) => set('accountId', id)} accounts={accounts} />
          )}

          {k !== 'document' && photo && (
            <div className="flex items-center justify-between gap-3 rounded-md border border-border-soft p-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-ink">Keep the photo in Documents</p>
                <p className="text-[11px] text-ink-muted">{draft.person ? `In ${draft.person}'s folder` : 'In your Inbox folder'} — handy for warranty, claims and proofs.</p>
              </div>
              <Switch checked={draft.keepPhoto} onChange={(v) => set('keepPhoto', v)} label="Keep the photo" />
            </div>
          )}
          {k === 'document' && <p className={cn('rounded-md bg-bg-soft px-3 py-2 text-[11px] text-ink-soft')}>The photo is saved in Documents{draft.person ? ` under ${draft.person}` : ''}{draft.expiryDate ? `, with a reminder before ${formatDate(draft.expiryDate)}` : ''}.</p>}
        </div>
      )}
    </SlideOver>
  )
}
