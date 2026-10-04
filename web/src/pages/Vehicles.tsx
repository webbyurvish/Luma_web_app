import { useEffect, useMemo, useState } from 'react'
import { Archive, Fuel, Gauge, Pencil, Plus, Trash2, Wrench } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SlideOver } from '@/components/ui/SlideOver'
import { ThemedSelect } from '@/components/ui/ThemedSelect'
import { Switch } from '@/components/ui/Switch'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { ListSkeleton } from '@/components/ui/Skeleton'
import { DeleteRecordDialog } from '@/components/ui/DeleteRecordDialog'
import { RowActions } from '@/components/ui/RowActions'
import { Chips, Field, RecordExpense, Stat } from '@/components/life/FormBits'
import { useVehicleLogs, useVehicles } from '@/hooks/useLife'
import { useTransactions } from '@/hooks/useTransactions'
import { useAccounts } from '@/hooks/useFinanceCollections'
import { useToast } from '@/context/ToastContext'
import { createLifeBulk } from '@/services/googleSheetsApi'
import { defaultAccountFor } from '@/lib/accountLinking'
import { addDaysIso } from '@/lib/family'
import {
  FUELS,
  LOG_KINDS,
  VEHICLE_ICON,
  VEHICLE_TYPES,
  dueText,
  kindForTransaction,
  latestOdometer,
  renewalDefault,
  runningStats,
  unloggedVehiclePayments,
  vehicleDues,
  type DueState,
} from '@/lib/vehicles'
import { formatCurrency } from '@/lib/formatCurrency'
import { formatDate, todayIstDateKey } from '@/lib/formatDate'
import { getErrorMessage } from '@/lib/errors'
import { cn } from '@/lib/cn'
import type { Transaction, Vehicle, VehicleInput, VehicleLog, VehicleLogInput, VehicleLogKind } from '@/types'

const DUE_CHIP: Record<DueState, string> = {
  overdue: 'bg-danger-soft text-danger',
  today: 'bg-danger-soft text-danger',
  soon: 'bg-warning-soft text-ink',
  ok: 'bg-bg-soft text-ink-soft',
  unset: 'bg-bg-soft text-ink-muted',
}

const isoOk = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v)
const numOrNull = (s: string) => (s.trim() === '' ? null : Number(s))

export function Vehicles() {
  const { showToast } = useToast()
  const today = todayIstDateKey()
  const { vehicles, loading, error, refetch, createVehicle, creating, updateVehicle, updating, deleteVehicle, deleting } = useVehicles()
  const { logs, refetch: refetchLogs, createLog, creating: savingLog, deleteLog } = useVehicleLogs()
  const { transactions, createTransaction } = useTransactions()
  const { accounts } = useAccounts()
  const [editor, setEditor] = useState<Vehicle | 'new' | null>(null)
  const [logFor, setLogFor] = useState<{ vehicleId?: string; kind?: VehicleLogKind; from?: Transaction } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Vehicle | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [logBusy, setLogBusy] = useState(false)

  const active = vehicles.filter((v) => v.isActive)
  const archived = vehicles.filter((v) => !v.isActive)
  const logsBy = useMemo(() => {
    const map = new Map<string, VehicleLog[]>()
    logs.forEach((l) => map.set(l.vehicleId, [...(map.get(l.vehicleId) ?? []), l]))
    return map
  }, [logs])
  const toLog = useMemo(() => unloggedVehiclePayments(transactions, logs, addDaysIso(today, -90)), [transactions, logs, today])
  const monthSpend = logs.filter((l) => l.date.slice(0, 7) === today.slice(0, 7)).reduce((s, l) => s + l.amount, 0)
  const dueCount = active.reduce((n, v) => n + vehicleDues(v, today, latestOdometer(logsBy.get(v.id) ?? [])).filter((d) => d.state === 'overdue' || d.state === 'today' || d.state === 'soon').length, 0)

  const saveVehicle = async (input: VehicleInput) => {
    try {
      if (editor && editor !== 'new') {
        await updateVehicle(editor.id, input)
        showToast('Saved')
      } else {
        await createVehicle(input)
        showToast(`${input.name} added — Luma will remind you before insurance, PUC and service are due`)
      }
      setEditor(null)
    } catch (err) {
      showToast(getErrorMessage(err, "Couldn't save the vehicle."), 'error')
    }
  }

  const logAll = async (vehicle: Vehicle) => {
    setBulkBusy(true)
    try {
      const res = await createLifeBulk(
        'vehiclelog',
        toLog.map((t) => ({ vehicleId: vehicle.id, date: t.date, kind: kindForTransaction(t), amount: t.amount, place: t.merchant ?? '', transactionId: t.sourceId ?? '', note: t.note ?? '' })),
      )
      await refetchLogs()
      showToast(res.failed ? `Logged ${res.created}, ${res.failed} couldn't be saved` : `Logged ${res.created} payment${res.created === 1 ? '' : 's'} to ${vehicle.name}`, res.failed ? 'error' : 'success')
    } catch (err) {
      showToast(getErrorMessage(err, "Couldn't log the payments."), 'error')
    } finally {
      setBulkBusy(false)
    }
  }

  if (loading) return <ListSkeleton rows={4} />
  if (error && !vehicles.length) return <ErrorState title="Couldn't load vehicles" description={error} onRetry={() => void refetch()} />

  return (
    <div className="flex flex-col gap-4 pt-3">
      {vehicles.length === 0 ? (
        <EmptyState
          icon={<Gauge size={20} />}
          title="Keep your vehicles' papers and running cost in one place"
          description="Add your car or bike: Luma reminds you before insurance, PUC and service are due, and turns fuel payments into cost per km."
          action={
            <Button size="sm" icon={<Plus size={13} />} onClick={() => setEditor('new')}>
              Add a vehicle
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <Stat label="Due soon" value={String(dueCount)} hint={dueCount ? 'needs action' : 'all good'} tone={dueCount ? 'danger' : 'ok'} />
            <Stat label="This month" value={formatCurrency(monthSpend)} hint="all costs" />
            <Stat label="Vehicles" value={String(active.length)} hint={archived.length ? `${archived.length} archived` : 'tracked'} />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="secondary" size="sm" icon={<Fuel size={13} />} onClick={() => setLogFor({ vehicleId: active[0]?.id })} disabled={!active.length}>
              Add entry
            </Button>
            <Button size="sm" icon={<Plus size={13} />} onClick={() => setEditor('new')}>
              Add vehicle
            </Button>
          </div>

          {toLog.length > 0 && active.length > 0 && (
            <Card className="p-0">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-soft px-4 py-2.5">
                <div>
                  <p className="text-[13px] font-semibold text-ink">Vehicle payments to log · {toLog.length}</p>
                  <p className="text-[11px] text-ink-muted">Fuel, tolls and service from your transactions (last 90 days)</p>
                </div>
                {active.length === 1 && (
                  <Button size="sm" loading={bulkBusy} loadingText="Logging…" onClick={() => void logAll(active[0])}>
                    Log all to {active[0].name}
                  </Button>
                )}
              </div>
              <ul className="divide-y divide-border-soft">
                {toLog.slice(0, 8).map((t) => (
                  <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-ink">{t.merchant || t.description}</p>
                      <p className="truncate text-[11px] text-ink-muted">
                        {formatDate(t.date)} · {kindForTransaction(t)}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono-figure text-[13px] font-semibold text-ink">{formatCurrency(t.amount)}</span>
                    <Button size="sm" variant="secondary" onClick={() => setLogFor({ vehicleId: active[0].id, kind: kindForTransaction(t), from: t })}>
                      Log
                    </Button>
                  </li>
                ))}
              </ul>
              {toLog.length > 8 && <p className="px-4 pb-3 text-[11px] text-ink-muted">+{toLog.length - 8} more</p>}
            </Card>
          )}

          {[...active, ...archived].map((v) => (
            <VehicleCard
              key={v.id}
              vehicle={v}
              logs={logsBy.get(v.id) ?? []}
              today={today}
              onAdd={(kind) => setLogFor({ vehicleId: v.id, kind })}
              onEdit={() => setEditor(v)}
              onArchive={async () => {
                try {
                  await updateVehicle(v.id, { isActive: !v.isActive })
                  showToast(v.isActive ? `${v.name} archived` : `${v.name} restored`)
                } catch (err) {
                  showToast(getErrorMessage(err, "Couldn't update."), 'error')
                }
              }}
              onDelete={() => setDeleteTarget(v)}
              onDeleteLog={async (l) => {
                try {
                  await deleteLog(l.id)
                  showToast('Entry removed')
                } catch (err) {
                  showToast(getErrorMessage(err, "Couldn't remove."), 'error')
                }
              }}
            />
          ))}
        </>
      )}

      <VehicleEditor open={editor !== null} value={editor === 'new' ? null : editor} saving={creating || updating} onClose={() => setEditor(null)} onSave={(i) => void saveVehicle(i)} />
      <LogEditor
        open={logFor !== null}
        preset={logFor}
        vehicles={active}
        logs={logs}
        accounts={accounts}
        saving={logBusy || savingLog}
        onClose={() => setLogFor(null)}
        onSave={async (input, extra) => {
          setLogBusy(true)
          try {
            await createLog(input)
            if (Object.keys(extra.vehicleChange).length) await updateVehicle(input.vehicleId, extra.vehicleChange)
            setLogFor(null)
          } catch (err) {
            showToast(getErrorMessage(err, "Couldn't save the entry."), 'error')
            setLogBusy(false)
            return
          }
          // The entry is safe now; the money side is a separate step with its own message.
          try {
            if (extra.recordExpense && input.amount > 0) {
              await createTransaction({
                date: input.date,
                amount: input.amount,
                type: 'Expense',
                category: 'Transport',
                subcategory: input.kind === 'Toll & parking' ? 'Tolls & parking' : input.kind,
                paymentMethod: 'UPI',
                merchant: input.place || (vehicles.find((v) => v.id === input.vehicleId)?.name ?? 'Vehicle'),
                note: input.note,
                accountId: extra.accountId,
              })
            }
            showToast(`${input.kind} entry saved`)
          } catch (err) {
            showToast(`Entry saved, but the transaction wasn't added: ${getErrorMessage(err, 'please add it from Transactions.')}`, 'error')
          } finally {
            setLogBusy(false)
          }
        }}
      />
      <DeleteRecordDialog
        open={deleteTarget !== null}
        recordType="vehicle"
        recordName={deleteTarget?.name}
        blockedReason={deleteTarget && (logsBy.get(deleteTarget.id)?.length ?? 0) > 0 ? 'This vehicle has entries in its log. Archive it instead so its history stays.' : null}
        loading={deleting}
        onConfirm={async () => {
          if (!deleteTarget) return
          try {
            await deleteVehicle(deleteTarget.id)
            showToast('Vehicle removed')
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

function VehicleCard({
  vehicle: v,
  logs,
  today,
  onAdd,
  onEdit,
  onArchive,
  onDelete,
  onDeleteLog,
}: {
  vehicle: Vehicle
  logs: VehicleLog[]
  today: string
  onAdd: (kind: VehicleLogKind) => void
  onEdit: () => void
  onArchive: () => void
  onDelete: () => void
  onDeleteLog: (l: VehicleLog) => void
}) {
  const [showAll, setShowAll] = useState(false)
  const Icon = VEHICLE_ICON[v.type]
  const odo = latestOdometer(logs)
  const dues = vehicleDues(v, today, odo)
  const stats = runningStats(logs)
  const thisMonth = logs.filter((l) => l.date.slice(0, 7) === today.slice(0, 7)).reduce((s, l) => s + l.amount, 0)
  const sorted = [...logs].sort((a, b) => (a.date === b.date ? (b.odometer ?? 0) - (a.odometer ?? 0) : a.date < b.date ? 1 : -1))
  const kmLeft = v.nextServiceKm && odo !== null ? v.nextServiceKm - odo : null

  return (
    <Card className={cn('p-0', !v.isActive && 'opacity-70')}>
      <div className="flex items-start gap-3 border-b border-border-soft px-4 py-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-bg-soft text-ink-soft">
          <Icon size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-ink">
            {v.name}
            {!v.isActive && <span className="ml-2 text-[11px] font-normal text-ink-muted">Archived</span>}
          </p>
          <p className="truncate font-mono-figure text-[11px] text-ink-muted">{[v.registrationNumber, v.fuel, v.owner].filter(Boolean).join(' · ') || v.type}</p>
        </div>
        <RowActions
          label={`Actions for ${v.name}`}
          actions={[
            { label: 'Edit', icon: <Pencil size={13} />, onClick: onEdit },
            { label: v.isActive ? 'Archive' : 'Restore', icon: <Archive size={13} />, onClick: onArchive },
            { label: 'Delete', icon: <Trash2 size={13} />, onClick: onDelete, tone: 'danger' },
          ]}
        />
      </div>

      <div className="grid grid-cols-3 gap-2 px-4 py-3">
        {dues.map((d) => (
          <div key={d.key} className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-muted">{d.label}</p>
            <span className={cn('mt-1 inline-block max-w-full truncate rounded-full px-2 py-0.5 text-[10.5px] font-medium', DUE_CHIP[d.state])}>
              {dueText(d, d.key === 'service' ? kmLeft : undefined)}
            </span>
            {d.date && <p className="mt-0.5 truncate text-[10.5px] text-ink-muted">{formatDate(d.date)}</p>}
            {d.key === 'service' && v.nextServiceKm ? <p className="truncate text-[10.5px] text-ink-muted">at {v.nextServiceKm.toLocaleString('en-IN')} km</p> : null}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border-soft px-4 py-3 text-[11.5px] sm:grid-cols-4">
        <Metric label="This month" value={formatCurrency(thisMonth)} />
        <Metric label="Odometer" value={odo !== null ? `${odo.toLocaleString('en-IN')} km` : '—'} />
        <Metric label="Fuel cost / km" value={stats.costPerKm !== null ? `₹${stats.costPerKm.toFixed(2)}` : '—'} hint={stats.costPerKm === null ? 'Add odometer on 2 fills' : undefined} />
        <Metric label="Mileage" value={stats.mileage !== null ? `${stats.mileage.toFixed(1)} km/${v.fuel === 'CNG' ? 'kg' : v.fuel === 'Electric' ? 'kWh' : 'L'}` : '—'} hint={stats.mileage === null ? 'Log quantity on full-tank fills' : undefined} />
      </div>

      {v.isActive && (
        <div className="flex flex-wrap gap-1.5 border-t border-border-soft px-4 py-2.5">
          <Button size="sm" variant="secondary" icon={<Fuel size={13} />} onClick={() => onAdd('Fuel')}>
            Fuel
          </Button>
          <Button size="sm" variant="secondary" icon={<Wrench size={13} />} onClick={() => onAdd('Service')}>
            Service
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onAdd('Insurance')}>
            Renewed insurance
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onAdd('PUC')}>
            New PUC
          </Button>
        </div>
      )}

      {sorted.length > 0 && (
        <ul className="divide-y divide-border-soft border-t border-border-soft">
          {(showAll ? sorted : sorted.slice(0, 4)).map((l) => (
            <li key={l.id} className="group flex items-center gap-3 px-4 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] text-ink">
                  <span className="font-medium">{l.kind}</span>
                  {l.place && <span className="text-ink-soft"> · {l.place}</span>}
                </p>
                <p className="truncate text-[11px] text-ink-muted">
                  {formatDate(l.date)}
                  {l.odometer !== null && ` · ${l.odometer.toLocaleString('en-IN')} km`}
                  {l.quantity !== null && ` · ${l.quantity}`}
                  {l.fullTank && ' · full'}
                  {l.note && ` · ${l.note}`}
                </p>
              </div>
              {l.amount > 0 && <span className="shrink-0 font-mono-figure text-[12.5px] text-ink">{formatCurrency(l.amount)}</span>}
              <RowActions label={`Actions for ${l.kind} on ${l.date}`} actions={[{ label: 'Remove', icon: <Trash2 size={13} />, onClick: () => onDeleteLog(l), tone: 'danger' }]} />
            </li>
          ))}
          {sorted.length > 4 && (
            <li className="px-4 py-2">
              <button type="button" className="text-[11.5px] font-medium text-rust hover:underline" onClick={() => setShowAll((s) => !s)}>
                {showAll ? 'Show less' : `Show all ${sorted.length} entries`}
              </button>
            </li>
          )}
        </ul>
      )}
    </Card>
  )
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] text-ink-muted">{label}</p>
      <p className="truncate font-mono-figure font-semibold text-ink">{value}</p>
      {hint && <p className="truncate text-[10px] text-ink-muted">{hint}</p>}
    </div>
  )
}

const EMPTY_VEHICLE: VehicleInput = { name: '', type: 'Car', registrationNumber: '', fuel: 'Petrol', owner: '', insuranceExpiry: '', pucExpiry: '', nextServiceDate: '', nextServiceKm: null, remindDaysBefore: 15, isActive: true, notes: '' }

function VehicleEditor({ open, value, saving, onClose, onSave }: { open: boolean; value: Vehicle | null; saving: boolean; onClose: () => void; onSave: (input: VehicleInput) => void }) {
  const [form, setForm] = useState<VehicleInput>(EMPTY_VEHICLE)
  const [kmText, setKmText] = useState('')
  const [attempted, setAttempted] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(value ? { ...EMPTY_VEHICLE, ...value, notes: value.notes ?? '' } : EMPTY_VEHICLE)
    setKmText(value?.nextServiceKm ? String(value.nextServiceKm) : '')
    setAttempted(false)
  }, [open, value])

  const set = <K extends keyof VehicleInput>(k: K, v: VehicleInput[K]) => setForm((f) => ({ ...f, [k]: v }))
  const nameError = form.name.trim() ? '' : 'Give it a name, e.g. "Swift" or "Activa".'
  const submit = () => {
    setAttempted(true)
    if (nameError) return
    onSave({
      ...form,
      name: form.name.trim(),
      registrationNumber: form.registrationNumber.trim().toUpperCase(),
      owner: form.owner.trim(),
      notes: form.notes.trim(),
      nextServiceKm: numOrNull(kmText),
    })
  }

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      busy={saving}
      title={value ? `Edit ${value.name}` : 'Add a vehicle'}
      subtitle="Papers and service — Luma reminds you before they're due"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} loading={saving} loadingText="Saving…">
            {value ? 'Save changes' : 'Add vehicle'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name" error={attempted ? nameError : ''}>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Swift, Activa…" autoFocus={!value} />
          </Field>
          <Field label="Registration number">
            <Input value={form.registrationNumber} onChange={(e) => set('registrationNumber', e.target.value)} placeholder="GJ 01 AB 1234" className="font-mono-figure uppercase" />
          </Field>
        </div>
        <Field label="Type">
          <Chips value={form.type} options={VEHICLE_TYPES} onChange={(v) => set('type', v)} />
        </Field>
        <Field label="Fuel">
          <Chips value={form.fuel || 'Petrol'} options={FUELS} onChange={(v) => set('fuel', v)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Insurance valid till">
            <Input type="date" value={form.insuranceExpiry} onChange={(e) => set('insuranceExpiry', e.target.value)} />
          </Field>
          <Field label="PUC valid till">
            <Input type="date" value={form.pucExpiry} onChange={(e) => set('pucExpiry', e.target.value)} />
          </Field>
          <Field label="Next service date">
            <Input type="date" value={form.nextServiceDate} onChange={(e) => set('nextServiceDate', e.target.value)} />
          </Field>
          <Field label="…or at (km)">
            <Input value={kmText} onChange={(e) => setKmText(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="45000" className="font-mono-figure" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Owner (optional)">
            <Input value={form.owner} onChange={(e) => set('owner', e.target.value)} placeholder="Me, Dad…" />
          </Field>
          <Field label="Remind me (days before)">
            <ThemedSelect value={String(form.remindDaysBefore)} onChange={(v) => set('remindDaysBefore', Number(v))} options={[7, 15, 30].map((d) => ({ value: String(d), label: `${d} days` }))} aria-label="Remind days before" />
          </Field>
        </div>
        <Field label="Notes (optional)">
          <Input value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Policy number, service centre…" />
        </Field>
      </div>
    </SlideOver>
  )
}

interface LogExtra {
  recordExpense: boolean
  accountId: string
  vehicleChange: Partial<VehicleInput>
}

function LogEditor({
  open,
  preset,
  vehicles,
  logs,
  accounts,
  saving,
  onClose,
  onSave,
}: {
  open: boolean
  preset: { vehicleId?: string; kind?: VehicleLogKind; from?: Transaction } | null
  vehicles: Vehicle[]
  logs: VehicleLog[]
  accounts: import('@/types').FinancialAccount[]
  saving: boolean
  onClose: () => void
  onSave: (input: VehicleLogInput, extra: LogExtra) => void
}) {
  const today = todayIstDateKey()
  const [form, setForm] = useState<VehicleLogInput>({ vehicleId: '', date: today, kind: 'Fuel', amount: 0, odometer: null, quantity: null, fullTank: true, place: '', transactionId: '', note: '' })
  const [amountText, setAmountText] = useState('')
  const [odoText, setOdoText] = useState('')
  const [qtyText, setQtyText] = useState('')
  const [validTill, setValidTill] = useState('')
  const [nextDate, setNextDate] = useState('')
  const [nextKm, setNextKm] = useState('')
  const [record, setRecord] = useState(false)
  const [accountId, setAccountId] = useState('')
  const [attempted, setAttempted] = useState(false)

  useEffect(() => {
    if (!open) return
    const t = preset?.from
    const kind = preset?.kind ?? 'Fuel'
    const date = t?.date ?? today
    setForm({ vehicleId: preset?.vehicleId ?? vehicles[0]?.id ?? '', date, kind, amount: t?.amount ?? 0, odometer: null, quantity: null, fullTank: kind === 'Fuel', place: t?.merchant ?? '', transactionId: t?.sourceId ?? '', note: t?.note ?? '' })
    setAmountText(t ? String(t.amount) : '')
    setOdoText('')
    setQtyText('')
    setValidTill(kind === 'Insurance' || kind === 'PUC' ? renewalDefault(kind, date) : '')
    setNextDate('')
    setNextKm('')
    setRecord(false)
    setAccountId(defaultAccountFor(accounts, 'UPI'))
    setAttempted(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preset])

  const set = <K extends keyof VehicleLogInput>(k: K, v: VehicleLogInput[K]) => setForm((f) => ({ ...f, [k]: v }))
  const setKind = (kind: VehicleLogKind) => {
    setForm((f) => ({ ...f, kind, fullTank: kind === 'Fuel' ? f.fullTank : false }))
    setValidTill(kind === 'Insurance' || kind === 'PUC' ? renewalDefault(kind, form.date) : '')
  }
  const vehicle = vehicles.find((v) => v.id === form.vehicleId)
  const lastOdo = latestOdometer(logs.filter((l) => l.vehicleId === form.vehicleId))
  const odo = numOrNull(odoText)
  const amount = amountText.trim() === '' ? 0 : Number(amountText)
  const errors = {
    vehicle: form.vehicleId ? '' : 'Choose the vehicle.',
    date: isoOk(form.date) ? '' : 'Pick the date.',
    amount: amount >= 0 ? '' : 'Enter the amount.',
    odometer: form.kind === 'Odometer' && odo === null ? 'Enter the reading.' : '',
  }
  const odoHint = odo !== null && lastOdo !== null && odo < lastOdo ? `Lower than the last reading (${lastOdo.toLocaleString('en-IN')} km) — check it.` : lastOdo !== null ? `Last reading ${lastOdo.toLocaleString('en-IN')} km` : undefined
  const qtyUnit = vehicle?.fuel === 'CNG' ? 'kg' : vehicle?.fuel === 'Electric' ? 'kWh' : 'litres'

  const submit = () => {
    setAttempted(true)
    if (Object.values(errors).some(Boolean)) return
    const vehicleChange: Partial<VehicleInput> = {}
    if (form.kind === 'Insurance' && isoOk(validTill)) vehicleChange.insuranceExpiry = validTill
    if (form.kind === 'PUC' && isoOk(validTill)) vehicleChange.pucExpiry = validTill
    if (form.kind === 'Service') {
      if (isoOk(nextDate)) vehicleChange.nextServiceDate = nextDate
      if (nextKm.trim()) vehicleChange.nextServiceKm = Number(nextKm)
    }
    onSave(
      { ...form, amount, odometer: odo, quantity: form.kind === 'Fuel' ? numOrNull(qtyText) : null, place: form.place.trim(), note: form.note.trim() },
      { recordExpense: record && !form.transactionId, accountId: record ? accountId : '', vehicleChange },
    )
  }

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      busy={saving}
      title={preset?.from ? 'Log this payment' : 'Add an entry'}
      subtitle={vehicle ? vehicle.name : 'Fuel, service, papers or an odometer reading'}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} loading={saving} loadingText="Saving…">
            Save entry
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {vehicles.length > 1 && (
          <Field label="Vehicle" error={attempted ? errors.vehicle : ''}>
            <ThemedSelect value={form.vehicleId} onChange={(v) => set('vehicleId', v)} options={vehicles.map((v) => ({ value: v.id, label: v.name }))} aria-label="Vehicle" />
          </Field>
        )}
        <Field label="What">
          <Chips value={form.kind} options={LOG_KINDS} onChange={setKind} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" error={attempted ? errors.date : ''}>
            <Input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
          </Field>
          <Field label="Amount (₹)" error={attempted ? errors.amount : ''}>
            <Input value={amountText} onChange={(e) => setAmountText(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" className="font-mono-figure" disabled={!!form.transactionId} />
          </Field>
          <Field label={form.kind === 'Odometer' ? 'Odometer (km)' : 'Odometer (km, optional)'} error={attempted ? errors.odometer : ''} hint={odoHint}>
            <Input value={odoText} onChange={(e) => setOdoText(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className="font-mono-figure" placeholder={lastOdo ? String(lastOdo) : ''} />
          </Field>
          {form.kind === 'Fuel' && (
            <Field label={`Quantity (${qtyUnit}, optional)`}>
              <Input value={qtyText} onChange={(e) => setQtyText(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" className="font-mono-figure" />
            </Field>
          )}
        </div>
        {form.kind === 'Fuel' && (
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-ink">Filled the tank full</p>
              <p className="text-[11px] text-ink-muted">Full fills with odometer + quantity give your real mileage.</p>
            </div>
            <Switch checked={form.fullTank} onChange={(v) => set('fullTank', v)} label="Full tank" />
          </div>
        )}
        {(form.kind === 'Insurance' || form.kind === 'PUC') && (
          <Field label={`New ${form.kind === 'PUC' ? 'PUC' : 'policy'} valid till`} hint="Updates the reminder for this vehicle.">
            <Input type="date" value={validTill} onChange={(e) => setValidTill(e.target.value)} />
          </Field>
        )}
        {form.kind === 'Service' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Next service date">
              <Input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
            </Field>
            <Field label="…or at (km)">
              <Input value={nextKm} onChange={(e) => setNextKm(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className="font-mono-figure" placeholder={odo ? String(odo + 5000) : ''} />
            </Field>
          </div>
        )}
        <Field label="Where (optional)">
          <Input value={form.place} onChange={(e) => set('place', e.target.value)} placeholder="Pump, garage…" />
        </Field>
        <Field label="Note (optional)">
          <Input value={form.note} onChange={(e) => set('note', e.target.value)} />
        </Field>
        {form.transactionId ? (
          <p className="rounded-md bg-bg-soft px-3 py-2 text-[11px] text-ink-soft">Linked to the payment already in your transactions — it won't be counted twice.</p>
        ) : (
          amount > 0 && <RecordExpense on={record} onToggle={setRecord} accountId={accountId} onAccount={setAccountId} accounts={accounts} />
        )}
      </div>
    </SlideOver>
  )
}
