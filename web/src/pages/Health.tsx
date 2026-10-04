import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ExternalLink, FileUp, HeartPulse, Info, Paperclip, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SlideOver } from '@/components/ui/SlideOver'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { ListSkeleton } from '@/components/ui/Skeleton'
import { DeleteRecordDialog } from '@/components/ui/DeleteRecordDialog'
import { RowActions } from '@/components/ui/RowActions'
import { Chips, Field, RecordExpense, Stat } from '@/components/life/FormBits'
import { useKnownPeople, useMedicalBills } from '@/hooks/useLife'
import { useTransactions } from '@/hooks/useTransactions'
import { useAccounts } from '@/hooks/useFinanceCollections'
import { useToast } from '@/context/ToastContext'
import { uploadToFamilyFolder } from '@/lib/driveUpload'
import { defaultAccountFor } from '@/lib/accountLinking'
import { addDaysIso } from '@/lib/family'
import { CLAIM_STATUSES, CLAIM_TONE, MEDICAL_KINDS, fyOf, fyRange, kindForPayee, outOfPocket, pendingClaims, unsortedHealthPayments } from '@/lib/medical'
import { formatCurrency } from '@/lib/formatCurrency'
import { formatDate, todayIstDateKey } from '@/lib/formatDate'
import { getErrorMessage } from '@/lib/errors'
import { cn } from '@/lib/cn'
import type { ClaimStatus, FinancialAccount, MedicalBill, MedicalBillInput, Transaction } from '@/types'

const isoOk = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v)
const numOrNull = (s: string) => (s.trim() === '' ? null : Number(s))
const CLAIM_ACTIVE: ClaimStatus[] = ['Claim filed', 'Reimbursed', 'Partly reimbursed', 'Rejected']

/** Bill photos go into "<Person>/Health & Medical" when the family folders exist. */
function uploadBill(file: File, bill: { person: string; date: string; provider: string; kind: string }) {
  return uploadToFamilyFolder(file, { person: bill.person, area: /health/i, name: `${bill.date} ${bill.person} ${bill.provider || bill.kind}`, description: `${bill.kind} bill · ${bill.person}`, tags: 'medical, bill' })
}

export function Health() {
  const { showToast } = useToast()
  const today = todayIstDateKey()
  const { bills, loading, error, refetch, createBill, creating, updateBill, updating, deleteBill, deleting } = useMedicalBills()
  const { transactions, createTransaction } = useTransactions()
  const { accounts } = useAccounts()
  const people = useKnownPeople(bills.map((b) => b.person))
  const [person, setPerson] = useState('All')
  const [fy, setFy] = useState(fyOf(today))
  const [editor, setEditor] = useState<{ bill?: MedicalBill; from?: Transaction } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MedicalBill | null>(null)
  const [busy, setBusy] = useState(false)

  const fys = useMemo(() => [...new Set([fyOf(today), ...bills.map((b) => fyOf(b.date))])].sort().reverse(), [bills, today])
  const range = fyRange(fy)
  const inFy = bills.filter((b) => b.date >= range.from && b.date <= range.to)
  const shown = inFy.filter((b) => person === 'All' || b.person === person).sort((a, b) => (a.date < b.date ? 1 : -1))
  const billPeople = [...new Set(bills.map((b) => b.person))].sort()
  const pending = pendingClaims(bills)
  const toSort = useMemo(() => unsortedHealthPayments(transactions, bills, addDaysIso(today, -180)), [transactions, bills, today])
  const perPerson = (() => {
    const map = new Map<string, { total: number; pocket: number; count: number }>()
    inFy.forEach((b) => {
      const p = map.get(b.person) ?? { total: 0, pocket: 0, count: 0 }
      map.set(b.person, { total: p.total + b.amount, pocket: p.pocket + outOfPocket(b), count: p.count + 1 })
    })
    return [...map.entries()].sort((a, b) => b[1].total - a[1].total)
  })()
  const fyTotal = inFy.reduce((s, b) => s + b.amount, 0)
  const fyBack = inFy.reduce((s, b) => s + (b.reimbursedAmount ?? 0), 0)
  const premiums = inFy.filter((b) => b.kind === 'Insurance premium').reduce((s, b) => s + b.amount, 0)
  const checkups = inFy.filter((b) => b.kind === 'Health check-up').reduce((s, b) => s + b.amount, 0)

  const save = async (input: MedicalBillInput, extra: { file: File | null; recordExpense: boolean; expenseAccount: string; recordRefund: boolean; refundAccount: string }) => {
    setBusy(true)
    try {
      let payload = input
      if (extra.file) {
        const saved = await uploadBill(extra.file, input)
        payload = { ...payload, driveFileId: saved.id, fileUrl: saved.url }
      }
      if (editor?.bill) await updateBill(editor.bill.id, payload)
      else await createBill(payload)
      setEditor(null)
      // The bill is safe now; the money side is a separate step with its own message.
      try {
        if (extra.recordExpense && input.amount > 0) {
          await createTransaction({ date: input.date, amount: input.amount, type: 'Expense', category: 'Health', subcategory: input.kind, paymentMethod: 'UPI', merchant: input.provider || input.kind, note: `${input.person}${input.notes ? ' · ' + input.notes : ''}`, accountId: extra.expenseAccount })
        }
        if (extra.recordRefund && (input.reimbursedAmount ?? 0) > 0) {
          await createTransaction({ date: today, amount: input.reimbursedAmount!, type: 'Income', category: 'Income', subcategory: 'Insurance claim', paymentMethod: 'Bank Transfer', merchant: input.insurer || 'Insurance', note: `Claim for ${input.person} · ${input.provider || input.kind}`, accountId: extra.refundAccount })
        }
        showToast(editor?.bill ? 'Bill updated' : `Bill saved for ${input.person}`)
      } catch (err) {
        showToast(`Bill saved, but the transaction wasn't added: ${getErrorMessage(err, 'please add it from Transactions.')}`, 'error')
      }
    } catch (err) {
      showToast(getErrorMessage(err, "Couldn't save the bill."), 'error')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <ListSkeleton rows={4} />
  if (error && !bills.length) return <ErrorState title="Couldn't load medical bills" description={error} onRetry={() => void refetch()} />

  return (
    <div className="flex flex-col gap-4 pt-3">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Stat label={`FY ${fy}`} value={formatCurrency(fyTotal)} hint={fyBack ? `${formatCurrency(fyBack)} paid back` : 'medical spend'} />
        <Stat label="Claims pending" value={String(pending.count)} hint={pending.count ? formatCurrency(pending.amount) : 'none'} tone={pending.count ? 'danger' : 'ok'} />
        <Stat label="Bills" value={String(inFy.length)} hint={`${perPerson.length} ${perPerson.length === 1 ? 'person' : 'people'}`} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {fys.length > 1 && <Chips value={fy} options={fys} onChange={setFy} />}
        </div>
        <Button size="sm" icon={<Plus size={13} />} onClick={() => setEditor({})}>
          Add bill
        </Button>
      </div>

      {toSort.length > 0 && (
        <Card className="p-0">
          <div className="border-b border-border-soft px-4 py-2.5">
            <p className="text-[13px] font-semibold text-ink">Health payments to sort · {toSort.length}</p>
            <p className="text-[11px] text-ink-muted">From your transactions (last 6 months) — tag who it was for to track claims and yearly totals</p>
          </div>
          <ul className="divide-y divide-border-soft">
            {toSort.slice(0, 8).map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-ink">{t.merchant || t.description}</p>
                  <p className="truncate text-[11px] text-ink-muted">
                    {formatDate(t.date)} · {kindForPayee(t.merchant ?? t.description)}
                    {t.note ? ` · ${t.note}` : ''}
                  </p>
                </div>
                <span className="shrink-0 font-mono-figure text-[13px] font-semibold text-ink">{formatCurrency(t.amount)}</span>
                <Button size="sm" variant="secondary" onClick={() => setEditor({ from: t })}>
                  Add
                </Button>
              </li>
            ))}
          </ul>
          {toSort.length > 8 && <p className="px-4 pb-3 text-[11px] text-ink-muted">+{toSort.length - 8} more</p>}
        </Card>
      )}

      {bills.length === 0 ? (
        <EmptyState
          icon={<HeartPulse size={20} />}
          title="Every medical bill, by family member"
          description="Tag doctor, lab and pharmacy bills to Mom, Dad or yourself, keep the bill photo in their Drive folder, and track insurance claims until the money comes back."
          action={
            <Button size="sm" icon={<Plus size={13} />} onClick={() => setEditor({})}>
              Add the first bill
            </Button>
          }
        />
      ) : (
        <>
          {billPeople.length > 1 && <Chips value={person} options={['All', ...billPeople]} onChange={setPerson} />}
          <Card className="p-0">
            {shown.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-ink-muted">No bills in FY {fy}{person !== 'All' ? ` for ${person}` : ''}.</p>
            ) : (
              <ul className="divide-y divide-border-soft">
                {shown.map((b) => (
                  <li key={b.id} className="group flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-ink">
                        {b.provider || b.kind}
                        {b.fileUrl && <Paperclip size={11} className="ml-1.5 inline text-ink-muted" aria-label="Bill attached" />}
                      </p>
                      <p className="truncate text-[11px] text-ink-muted">
                        {b.person} · {b.kind} · {formatDate(b.date)}
                        {b.notes ? ` · ${b.notes}` : ''}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono-figure text-[13px] font-semibold text-ink">{formatCurrency(b.amount)}</p>
                      <span className={cn('mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium', CLAIM_TONE[b.claimStatus])}>
                        {b.claimStatus}
                        {b.reimbursedAmount ? ` · ${formatCurrency(b.reimbursedAmount)}` : ''}
                      </span>
                    </div>
                    <RowActions
                      label={`Actions for ${b.provider || b.kind}`}
                      actions={[
                        { label: 'View bill', icon: <ExternalLink size={13} />, onClick: () => window.open(b.fileUrl, '_blank', 'noopener'), hidden: !b.fileUrl },
                        { label: 'Edit / claim', icon: <Pencil size={13} />, onClick: () => setEditor({ bill: b }) },
                        { label: 'Delete', icon: <Trash2 size={13} />, onClick: () => setDeleteTarget(b), tone: 'danger' },
                      ]}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {perPerson.length > 0 && (
            <Card>
              <p className="mb-2 text-sm font-semibold text-ink">FY {fy} by person</p>
              <ul className="divide-y divide-border-soft">
                {perPerson.map(([name, p]) => (
                  <li key={name} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                    <span className="truncate text-ink">
                      {name} <span className="text-[11px] text-ink-muted">· {p.count} bill{p.count === 1 ? '' : 's'}</span>
                    </span>
                    <span className="shrink-0 text-right font-mono-figure">
                      <span className="font-semibold text-ink">{formatCurrency(p.total)}</span>
                      {p.pocket !== p.total && <span className="block text-[10.5px] text-ink-muted">{formatCurrency(p.pocket)} after claims</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card variant="inset">
            <p className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-ink">
              <Info size={14} className="text-rust" /> At tax time (section 80D, old tax regime)
            </p>
            <ul className="list-disc space-y-1 pl-4 text-[11.5px] leading-relaxed text-ink-soft">
              <li>
                Health insurance premiums this FY: <b className="font-mono-figure text-ink">{formatCurrency(premiums)}</b> — log them as “Insurance premium”.
              </li>
              <li>
                Preventive health check-ups: <b className="font-mono-figure text-ink">{formatCurrency(checkups)}</b> — up to ₹5,000 counts, inside the overall 80D limit.
              </li>
              <li>Medical bills of parents aged 60+ who have no health insurance can count, up to ₹50,000. Other bills don't qualify under 80D.</li>
              <li>The new tax regime doesn't allow 80D. Confirm the limits with your CA or the current rules before filing.</li>
            </ul>
          </Card>
        </>
      )}

      <BillEditor
        open={editor !== null}
        value={editor?.bill ?? null}
        from={editor?.from ?? null}
        people={people}
        accounts={accounts}
        saving={busy || creating || updating}
        onClose={() => setEditor(null)}
        onSave={(i, extra) => void save(i, extra)}
      />
      <DeleteRecordDialog
        open={deleteTarget !== null}
        recordType="medical bill"
        recordName={deleteTarget ? `${deleteTarget.provider || deleteTarget.kind} · ${formatCurrency(deleteTarget.amount)}` : undefined}
        loading={deleting}
        onConfirm={async () => {
          if (!deleteTarget) return
          try {
            await deleteBill(deleteTarget.id)
            showToast('Bill removed — the payment and any Drive photo are kept')
            setDeleteTarget(null)
          } catch (err) {
            showToast(getErrorMessage(err, "Couldn't delete."), 'error')
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

const EMPTY_BILL = (today: string): MedicalBillInput => ({
  person: '',
  date: today,
  kind: 'Doctor',
  provider: '',
  amount: 0,
  transactionId: '',
  claimStatus: 'Not claimed',
  insurer: '',
  claimNumber: '',
  claimedAmount: null,
  reimbursedAmount: null,
  driveFileId: '',
  fileUrl: '',
  notes: '',
})

function BillEditor({
  open,
  value,
  from,
  people,
  accounts,
  saving,
  onClose,
  onSave,
}: {
  open: boolean
  value: MedicalBill | null
  from: Transaction | null
  people: string[]
  accounts: FinancialAccount[]
  saving: boolean
  onClose: () => void
  onSave: (input: MedicalBillInput, extra: { file: File | null; recordExpense: boolean; expenseAccount: string; recordRefund: boolean; refundAccount: string }) => void
}) {
  const today = todayIstDateKey()
  const peopleId = useId()
  const fileInput = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState<MedicalBillInput>(EMPTY_BILL(today))
  const [amountText, setAmountText] = useState('')
  const [claimedText, setClaimedText] = useState('')
  const [backText, setBackText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [recordExpense, setRecordExpense] = useState(false)
  const [expenseAccount, setExpenseAccount] = useState('')
  const [recordRefund, setRecordRefund] = useState(true)
  const [refundAccount, setRefundAccount] = useState('')
  const [attempted, setAttempted] = useState(false)

  useEffect(() => {
    if (!open) return
    const base = value
      ? { ...EMPTY_BILL(today), ...value }
      : from
        ? { ...EMPTY_BILL(today), date: from.date, amount: from.amount, provider: from.merchant ?? '', kind: kindForPayee(from.merchant ?? from.description), transactionId: from.sourceId ?? '', notes: from.note ?? '' }
        : EMPTY_BILL(today)
    setForm(base)
    setAmountText(value || from ? String(base.amount) : '')
    setClaimedText(value?.claimedAmount ? String(value.claimedAmount) : '')
    setBackText(value?.reimbursedAmount ? String(value.reimbursedAmount) : '')
    setFile(null)
    setRecordExpense(false)
    setExpenseAccount(defaultAccountFor(accounts, 'UPI'))
    setRecordRefund(true)
    setRefundAccount(defaultAccountFor(accounts, 'Bank Transfer'))
    setAttempted(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, value, from])

  const set = <K extends keyof MedicalBillInput>(k: K, v: MedicalBillInput[K]) => setForm((f) => ({ ...f, [k]: v }))
  const amount = Number(amountText)
  const back = numOrNull(backText)
  const claimOpen = CLAIM_ACTIVE.includes(form.claimStatus)
  const paidBack = form.claimStatus === 'Reimbursed' || form.claimStatus === 'Partly reimbursed'
  // Offer to record the refund only when it's newly paid back (not on every later edit).
  const newRefund = paidBack && (back ?? 0) > 0 && (back ?? 0) !== (value?.reimbursedAmount ?? 0)
  const errors = {
    person: form.person.trim() ? '' : 'Who was it for?',
    date: isoOk(form.date) ? '' : 'Pick the date.',
    amount: amountText.trim() !== '' && amount >= 0 ? '' : 'Enter the bill amount.',
  }
  const submit = () => {
    setAttempted(true)
    if (Object.values(errors).some(Boolean)) return
    onSave(
      {
        ...form,
        person: form.person.trim(),
        provider: form.provider.trim(),
        insurer: form.insurer.trim(),
        claimNumber: form.claimNumber.trim(),
        notes: form.notes.trim(),
        amount,
        claimedAmount: claimOpen ? numOrNull(claimedText) : null,
        reimbursedAmount: paidBack ? back : null,
      },
      { file, recordExpense: recordExpense && !form.transactionId && !value, expenseAccount, recordRefund: newRefund && recordRefund, refundAccount },
    )
  }

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      busy={saving}
      busyLabel={file ? 'Uploading the bill and saving…' : undefined}
      title={value ? 'Edit bill' : from ? 'Add this payment as a bill' : 'Add a medical bill'}
      subtitle="Who it was for, what it was, and the insurance claim"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} loading={saving} loadingText="Saving…">
            {value ? 'Save changes' : 'Save bill'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="For" error={attempted ? errors.person : ''}>
            <Input list={peopleId} value={form.person} onChange={(e) => set('person', e.target.value)} placeholder="Me, Mom, Dad…" autoFocus={!value} />
            <datalist id={peopleId}>
              {people.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </Field>
          <Field label="Date" error={attempted ? errors.date : ''}>
            <Input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
          </Field>
        </div>
        <Field label="What">
          <Chips value={form.kind} options={MEDICAL_KINDS} onChange={(v) => set('kind', v)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Doctor / hospital / shop">
            <Input value={form.provider} onChange={(e) => set('provider', e.target.value)} placeholder="Apollo Pharmacy" />
          </Field>
          <Field label="Amount (₹)" error={attempted ? errors.amount : ''}>
            <Input value={amountText} onChange={(e) => setAmountText(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" className="font-mono-figure" disabled={!!form.transactionId} />
          </Field>
        </div>

        <div className="space-y-3 rounded-md border border-border-soft p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-ink">
            <ShieldCheck size={13} className="text-success" /> Insurance claim
          </p>
          <Chips value={form.claimStatus} options={CLAIM_STATUSES} onChange={(v) => set('claimStatus', v)} />
          {claimOpen && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Insurer / TPA">
                <Input value={form.insurer} onChange={(e) => set('insurer', e.target.value)} placeholder="Star Health" />
              </Field>
              <Field label="Claim number">
                <Input value={form.claimNumber} onChange={(e) => set('claimNumber', e.target.value)} className="font-mono-figure" />
              </Field>
              <Field label="Claimed (₹)">
                <Input value={claimedText} onChange={(e) => setClaimedText(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" className="font-mono-figure" placeholder={amountText} />
              </Field>
              {paidBack && (
                <Field label="Paid back (₹)">
                  <Input value={backText} onChange={(e) => setBackText(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" className="font-mono-figure" />
                </Field>
              )}
            </div>
          )}
          {newRefund && (
            <RecordExpense
              on={recordRefund}
              onToggle={setRecordRefund}
              accountId={refundAccount}
              onAccount={setRefundAccount}
              accounts={accounts}
              label={`Add ${formatCurrency(back ?? 0)} received to my transactions`}
              hint="Records the claim money as income in the account it came to."
              accountLabel="Received in"
            />
          )}
        </div>

        <Field label="Bill photo or PDF (optional)" hint={value?.fileUrl && !file ? 'A bill is attached — choosing a new file adds it to Drive too.' : "Saved in this person's Health & Medical folder in Documents."}>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="flex w-full items-center gap-2 rounded-sm border border-dashed border-border px-3 py-2.5 text-left text-xs text-ink-soft hover:border-rust/60 hover:bg-bg-soft"
          >
            <FileUp size={14} className="shrink-0 text-rust" />
            <span className="truncate">{file ? file.name : value?.fileUrl ? 'Replace the attached bill' : 'Take a photo or choose a file'}</span>
          </button>
          <input ref={fileInput} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => (setFile(e.target.files?.[0] ?? null), (e.target.value = ''))} />
        </Field>
        <Field label="Note (optional)">
          <Input value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Fever, follow-up visit…" />
        </Field>

        {form.transactionId ? (
          <p className="rounded-md bg-bg-soft px-3 py-2 text-[11px] text-ink-soft">Linked to the payment already in your transactions — it won't be counted twice.</p>
        ) : (
          !value && amount > 0 && <RecordExpense on={recordExpense} onToggle={setRecordExpense} accountId={expenseAccount} onAccount={setExpenseAccount} accounts={accounts} />
        )}
      </div>
    </SlideOver>
  )
}
