import { useEffect, useId, useMemo, useState } from 'react'
import { CheckCircle2, History, Pencil, Plus, Smartphone, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { SlideOver } from '@/components/ui/SlideOver'
import { ThemedSelect } from '@/components/ui/ThemedSelect'
import { Switch } from '@/components/ui/Switch'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { ListSkeleton } from '@/components/ui/Skeleton'
import { DeleteRecordDialog } from '@/components/ui/DeleteRecordDialog'
import { RowActions } from '@/components/ui/RowActions'
import { AccountSelect } from '@/components/finance/AccountSelect'
import { useRechargeHistory, useRecharges } from '@/hooks/useFamily'
import { useAccounts } from '@/hooks/useFinanceCollections'
import { useToast } from '@/context/ToastContext'
import { accountsForMethod, defaultAccountFor, previewBalanceChanges } from '@/lib/accountLinking'
import { SERVICE_NAMES, addDaysIso, expiryLabel, monthlyRechargeSpend, nextExpiry, rechargeStatus, serviceMeta, type RechargeState, serviceInText } from '@/lib/family'
import { formatCurrency } from '@/lib/formatCurrency'
import { formatDate, todayIstDateKey } from '@/lib/formatDate'
import { getErrorMessage } from '@/lib/errors'
import { cn } from '@/lib/cn'
import type { FinancialAccount, Recharge, RechargeInput } from '@/types'

const CHIP: Record<RechargeState, string> = {
  expired: 'bg-danger-soft text-danger',
  today: 'bg-danger-soft text-danger',
  soon: 'bg-warning-soft text-ink',
  ok: 'bg-bg-soft text-ink-soft',
  paused: 'bg-bg-soft text-ink-muted',
}

export function RechargesSection({ knownPeople }: { knownPeople: string[] }) {
  const { showToast } = useToast()
  const { recharges, loading, error, refetch, createRecharge, creating, updateRecharge, updating, deleteRecharge, deleting, markRecharged, recording } = useRecharges()
  const { accounts } = useAccounts()
  const today = todayIstDateKey()
  const [editor, setEditor] = useState<Recharge | 'new' | null>(null)
  const [doneTarget, setDoneTarget] = useState<Recharge | null>(null)
  const [historyFor, setHistoryFor] = useState<Recharge | 'all' | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Recharge | null>(null)

  const rows = useMemo(() => recharges.map((r) => ({ r, ...rechargeStatus(r, today) })), [recharges, today])
  const byPerson = useMemo(() => {
    const map = new Map<string, typeof rows>()
    rows
      .slice()
      .sort((a, b) => a.days - b.days)
      .forEach((row) => map.set(row.r.person, [...(map.get(row.r.person) ?? []), row]))
    return [...map.entries()].sort((a, b) => Math.min(...a[1].map((x) => x.days)) - Math.min(...b[1].map((x) => x.days)))
  }, [rows])
  const attention = rows.filter((x) => x.state === 'expired' || x.state === 'today' || x.state === 'soon')

  const save = async (input: RechargeInput) => {
    try {
      if (editor && editor !== 'new') {
        await updateRecharge(editor.id, input)
        showToast('Updated')
      } else {
        await createRecharge(input)
        showToast(`${input.person}'s ${serviceInText(input.service)} added — reminded before it expires`)
      }
      setEditor(null)
    } catch (err) {
      showToast(getErrorMessage(err, "Couldn't save."), 'error')
    }
  }

  if (loading) return <ListSkeleton rows={4} />
  if (error && !recharges.length) return <ErrorState title="Couldn't load recharges" description={error} onRetry={() => void refetch()} />

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Stat label="Need recharge" value={String(attention.length)} hint={attention.length ? 'expiring or expired' : 'all good'} tone={attention.length ? 'danger' : 'ok'} />
        <Stat label="Tracked" value={String(recharges.filter((r) => r.isActive).length)} hint="numbers and services" />
        <Stat label="Per month" value={formatCurrency(monthlyRechargeSpend(recharges))} hint="across the family" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" icon={<History size={13} />} onClick={() => setHistoryFor('all')}>
          Recharge history
        </Button>
        <Button size="sm" icon={<Plus size={13} />} onClick={() => setEditor('new')}>
          Add number
        </Button>
      </div>

      {recharges.length === 0 ? (
        <EmptyState
          icon={<Smartphone size={20} />}
          title="Track every family recharge"
          description="Add Mom's and Dad's mobiles, the DTH, FASTag and broadband — Luma reminds you before any of them runs out."
          action={
            <Button size="sm" icon={<Plus size={13} />} onClick={() => setEditor('new')}>
              Add the first number
            </Button>
          }
        />
      ) : (
        byPerson.map(([person, list]) => (
          <Card key={person} className="p-0">
            <p className="border-b border-border-soft px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft">{person}</p>
            <ul className="divide-y divide-border-soft">
              {list.map(({ r, state, days }) => {
                const Icon = serviceMeta(r.service).icon
                return (
                  <li key={r.id} className="group flex flex-wrap items-center gap-3 px-4 py-3">
                    <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', state === 'expired' || state === 'today' ? 'bg-danger-soft text-danger' : 'bg-bg-soft text-ink-soft')}>
                      <Icon size={15} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-ink">
                        {r.service}
                        {r.provider && <span className="font-normal text-ink-soft"> · {r.provider}</span>}
                      </p>
                      <p className="truncate font-mono-figure text-[11px] text-ink-muted">
                        {r.number || '—'}
                        {r.plan && <span className="font-sans"> · {r.plan}</span>}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono-figure text-[13px] font-semibold text-ink">{formatCurrency(r.amount)}</p>
                      <span className={cn('mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium', CHIP[state])}>
                        {state === 'paused' ? 'Paused' : `${expiryLabel(days)} · ${formatDate(r.expiresOn)}`}
                      </span>
                    </div>
                    <div className="flex w-full items-center justify-end gap-1 sm:w-auto">
                      <Button size="sm" variant={state === 'ok' ? 'secondary' : 'primary'} icon={<CheckCircle2 size={13} />} onClick={() => setDoneTarget(r)}>
                        Recharged
                      </Button>
                      <RowActions
                        label={`Actions for ${r.person}'s ${r.service}`}
                        actions={[
                          { label: 'History', icon: <History size={13} />, onClick: () => setHistoryFor(r) },
                          { label: 'Edit', icon: <Pencil size={13} />, onClick: () => setEditor(r) },
                          { label: 'Delete', icon: <Trash2 size={13} />, onClick: () => setDeleteTarget(r), tone: 'danger' },
                        ]}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          </Card>
        ))
      )}

      <RechargeEditor open={editor !== null} value={editor === 'new' ? null : editor} knownPeople={knownPeople} saving={creating || updating} onClose={() => setEditor(null)} onSave={(i) => void save(i)} />
      <RechargedDialog
        target={doneTarget}
        accounts={accounts}
        today={today}
        busy={recording}
        onClose={() => setDoneTarget(null)}
        onConfirm={async (details) => {
          if (!doneTarget) return
          try {
            const res = await markRecharged(doneTarget.id, { expectedExpiry: doneTarget.expiresOn, ...details })
            void res
            showToast(`Recorded — ${doneTarget.person}'s ${serviceInText(doneTarget.service)} now runs till ${formatDate(nextExpiry(doneTarget.expiresOn, details.date, details.validityDays))}`)
            setDoneTarget(null)
          } catch (err) {
            showToast(getErrorMessage(err, "Couldn't record the recharge."), 'error')
            if (err && typeof err === 'object' && 'alreadyDone' in err && err.alreadyDone) setDoneTarget(null)
          }
        }}
      />
      <HistoryPanel target={historyFor} onClose={() => setHistoryFor(null)} />
      <DeleteRecordDialog
        open={deleteTarget !== null}
        recordType="recharge"
        recordName={deleteTarget ? `${deleteTarget.person} · ${deleteTarget.service}` : undefined}
        loading={deleting}
        onConfirm={async () => {
          if (!deleteTarget) return
          try {
            await deleteRecharge(deleteTarget.id)
            showToast('Removed')
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

function Stat({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: 'danger' | 'ok' }) {
  return (
    <Card className="min-w-0 px-3 py-3 sm:px-4 sm:py-3.5">
      <p className="text-[9.5px] font-semibold uppercase leading-tight tracking-[0.06em] text-ink-muted sm:text-[10.5px] sm:tracking-[0.08em]">{label}</p>
      <p className={cn('mt-1 truncate font-mono-figure text-[15px] font-semibold sm:text-xl', tone === 'danger' ? 'text-danger' : 'text-ink')}>{value}</p>
      <p className={cn('mt-0.5 truncate text-[11px]', tone === 'ok' ? 'text-success' : 'text-ink-muted')}>{hint}</p>
    </Card>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-ink-soft">{label}</p>
      {children}
      {error && <p className="mt-1 text-[11px] text-danger">{error}</p>}
    </div>
  )
}

function RechargeEditor({
  open,
  value,
  knownPeople,
  saving,
  onClose,
  onSave,
}: {
  open: boolean
  value: Recharge | null
  knownPeople: string[]
  saving: boolean
  onClose: () => void
  onSave: (input: RechargeInput) => void
}) {
  const peopleId = useId()
  const providerId = useId()
  const today = todayIstDateKey()
  const [form, setForm] = useState<RechargeInput>({ person: '', service: 'Mobile', provider: '', number: '', plan: '', amount: 0, validityDays: 28, expiresOn: addDaysIso(today, 28), remindDaysBefore: 3, isActive: true, notes: '' })
  const [amountText, setAmountText] = useState('')
  const [attempted, setAttempted] = useState(false)
  const [expiryTouched, setExpiryTouched] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(
      value
        ? { person: value.person, service: value.service, provider: value.provider, number: value.number, plan: value.plan, amount: value.amount, validityDays: value.validityDays, expiresOn: value.expiresOn, remindDaysBefore: value.remindDaysBefore, isActive: value.isActive, notes: value.notes ?? '' }
        : { person: '', service: 'Mobile', provider: '', number: '', plan: '', amount: 0, validityDays: 28, expiresOn: addDaysIso(today, 28), remindDaysBefore: 3, isActive: true, notes: '' },
    )
    setAmountText(value ? String(value.amount) : '')
    setAttempted(false)
    setExpiryTouched(!!value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, value])

  const set = <K extends keyof RechargeInput>(k: K, v: RechargeInput[K]) => setForm((f) => ({ ...f, [k]: v }))
  const meta = serviceMeta(form.service)
  const amount = Number(amountText)
  const errors = {
    person: form.person.trim() ? '' : 'Whose is it?',
    amount: amountText.trim() !== '' && amount >= 0 ? '' : 'Enter the plan amount.',
    validity: form.validityDays >= 1 ? '' : 'Enter the validity in days.',
    expires: /^\d{4}-\d{2}-\d{2}$/.test(form.expiresOn) ? '' : 'Pick the expiry date.',
  }
  const submit = () => {
    setAttempted(true)
    if (Object.values(errors).some(Boolean)) return
    onSave({ ...form, amount, person: form.person.trim(), number: form.number.trim(), plan: form.plan.trim(), provider: form.provider.trim(), notes: form.notes.trim() })
  }
  const setValidity = (days: number) => {
    setForm((f) => ({ ...f, validityDays: days, expiresOn: expiryTouched ? f.expiresOn : addDaysIso(today, days) }))
  }

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      busy={saving}
      title={value ? 'Edit recharge' : 'Add a number to track'}
      subtitle="Mobile, DTH, FASTag, broadband — anything prepaid"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} loading={saving} loadingText="Saving…">
            {value ? 'Save changes' : 'Add'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Whose" error={attempted ? errors.person : ''}>
            <Input list={peopleId} value={form.person} onChange={(e) => set('person', e.target.value)} placeholder="Mom, Dad, Me…" autoFocus={!value} />
            <datalist id={peopleId}>
              {knownPeople.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </Field>
          <Field label="What">
            <ThemedSelect value={form.service} onChange={(v) => setForm((f) => ({ ...f, service: v, provider: '' }))} options={SERVICE_NAMES.map((s) => ({ value: s, label: s }))} aria-label="Service" />
          </Field>
          <Field label="Provider">
            <Input list={providerId} value={form.provider} onChange={(e) => set('provider', e.target.value)} placeholder={meta.providers[0] ?? 'Provider'} />
            <datalist id={providerId}>
              {meta.providers.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </Field>
          <Field label={meta.numberLabel}>
            <Input value={form.number} onChange={(e) => set('number', e.target.value)} inputMode={form.service === 'Mobile' ? 'tel' : 'text'} className="font-mono-figure" />
          </Field>
        </div>
        <Field label="Plan (optional)">
          <Input value={form.plan} onChange={(e) => set('plan', e.target.value)} placeholder="₹349 · 2.5 GB/day · unlimited calls" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (₹)" error={attempted ? errors.amount : ''}>
            <Input value={amountText} onChange={(e) => setAmountText(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" className="font-mono-figure" />
          </Field>
          <Field label="Validity (days)" error={attempted ? errors.validity : ''}>
            <Input value={String(form.validityDays || '')} onChange={(e) => setValidity(Number(e.target.value.replace(/\D/g, '')) || 0)} inputMode="numeric" className="font-mono-figure" />
          </Field>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {meta.validityChips.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setValidity(d)}
              className={cn('rounded-full border px-3 py-1.5 text-[11.5px] transition-colors', form.validityDays === d ? 'border-ink bg-ink text-paper' : 'border-border text-ink-soft hover:bg-bg-soft')}
            >
              {d === 365 ? '1 year' : `${d} days`}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Current plan expires on" error={attempted ? errors.expires : ''}>
            <Input
              type="date"
              value={form.expiresOn}
              onChange={(e) => {
                setExpiryTouched(true)
                set('expiresOn', e.target.value)
              }}
            />
          </Field>
          <Field label="Remind me">
            <ThemedSelect
              value={String(form.remindDaysBefore)}
              onChange={(v) => set('remindDaysBefore', Number(v))}
              options={[0, 1, 2, 3, 5, 7].map((d) => ({ value: String(d), label: d === 0 ? 'On the day' : `${d} day${d > 1 ? 's' : ''} before` }))}
              aria-label="Remind me"
            />
          </Field>
        </div>
        <Field label="Notes (optional)">
          <Input value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Recharge via Paytm, plan includes Netflix…" />
        </Field>
        {value && (
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-ink-soft">Active (paused numbers don't remind you)</p>
            <Switch checked={form.isActive} onChange={(v) => set('isActive', v)} label="Active" />
          </div>
        )}
      </div>
    </SlideOver>
  )
}

function RechargedDialog({
  target,
  accounts,
  today,
  busy,
  onClose,
  onConfirm,
}: {
  target: Recharge | null
  accounts: FinancialAccount[]
  today: string
  busy: boolean
  onClose: () => void
  onConfirm: (details: { date: string; amount: number; plan?: string; validityDays: number; recordExpense: boolean; accountId?: string; paymentMethod?: string }) => Promise<void>
}) {
  const [amountText, setAmountText] = useState('')
  const [plan, setPlan] = useState('')
  const [validity, setValidity] = useState(28)
  const [date, setDate] = useState(today)
  const [record, setRecord] = useState(true)
  const [accountId, setAccountId] = useState('')

  useEffect(() => {
    if (!target) return
    setAmountText(String(target.amount))
    setPlan(target.plan)
    setValidity(target.validityDays)
    setDate(today)
    setRecord(true)
    setAccountId(defaultAccountFor(accounts, 'UPI'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target])

  if (!target) return <Modal open={false} onClose={onClose} title="">{null}</Modal>
  const amount = Number(amountText)
  const until = nextExpiry(target.expiresOn, date, validity || 0)
  const { suggested, others } = accountsForMethod(accounts.filter((a) => a.isActive), 'UPI')
  const change = record && accountId ? previewBalanceChanges(accounts, { kind: 'expense', amount: amount || 0, accountId })[0] : undefined
  const queued = target.expiresOn > date

  return (
    <Modal open onClose={onClose} busy={busy} title={`${target.person}'s ${serviceInText(target.service)} recharged`} subtitle={[target.provider, target.number].filter(Boolean).join(' · ')}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (₹)">
            <Input value={amountText} onChange={(e) => setAmountText(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" className="font-mono-figure" />
          </Field>
          <Field label="Validity (days)">
            <Input value={String(validity || '')} onChange={(e) => setValidity(Number(e.target.value.replace(/\D/g, '')) || 0)} inputMode="numeric" className="font-mono-figure" />
          </Field>
          <Field label="Recharged on">
            <Input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Plan">
            <Input value={plan} onChange={(e) => setPlan(e.target.value)} placeholder="Same as before" />
          </Field>
        </div>
        <p className="rounded-sm bg-success-soft px-3 py-2 text-[11.5px] text-ink">
          New expiry: <span className="font-semibold">{formatDate(until)}</span>
          {queued && <span className="text-ink-soft"> — starts after the current plan ends {formatDate(target.expiresOn)}</span>}
        </p>
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-ink-soft">Also record it as an expense</p>
          <Switch checked={record} onChange={setRecord} label="Record as expense" />
        </div>
        {record && <AccountSelect label="Paid from" value={accountId} onChange={setAccountId} suggested={suggested} others={others} change={change} />}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            size="sm"
            icon={<CheckCircle2 size={13} />}
            loading={busy}
            loadingText="Recording…"
            disabled={!(amount >= 0) || !(validity >= 1) || !date}
            onClick={() => void onConfirm({ date, amount, plan: plan.trim() || undefined, validityDays: validity, recordExpense: record, accountId: record ? accountId : undefined, paymentMethod: 'UPI' })}
          >
            Save recharge
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function HistoryPanel({ target, onClose }: { target: Recharge | 'all' | null; onClose: () => void }) {
  const { history, loading } = useRechargeHistory()
  const list = (target === 'all' ? history : history.filter((h) => target && h.rechargeId === target.id)).slice().sort((a, b) => (a.rechargedOn < b.rechargedOn ? 1 : -1))
  const total = list.reduce((s, h) => s + h.amount, 0)
  return (
    <SlideOver
      open={target !== null}
      onClose={onClose}
      title="Recharge history"
      subtitle={target && target !== 'all' ? `${target.person} · ${target.service}${target.number ? ' · ' + target.number : ''}` : 'Every recharge in the family'}
    >
      {loading ? (
        <ListSkeleton rows={4} />
      ) : list.length === 0 ? (
        <p className="py-10 text-center text-xs text-ink-muted">No recharges recorded yet. Tap “Recharged” after each one.</p>
      ) : (
        <>
          <p className="mb-3 text-xs text-ink-soft">
            {list.length} recharge{list.length === 1 ? '' : 's'} · {formatCurrency(total)} in total
          </p>
          <ul className="divide-y divide-border-soft">
            {list.map((h) => (
              <li key={h.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-ink">
                    {target === 'all' && <span className="font-medium">{h.person} · </span>}
                    {h.service}
                    {h.provider && <span className="text-ink-soft"> · {h.provider}</span>}
                  </p>
                  <p className="truncate text-[11px] text-ink-muted">
                    {formatDate(h.rechargedOn)} · valid till {formatDate(h.validUntil)}
                    {h.plan && ` · ${h.plan}`}
                  </p>
                </div>
                <span className="shrink-0 font-mono-figure text-[13px] font-semibold text-ink">{formatCurrency(h.amount)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </SlideOver>
  )
}
