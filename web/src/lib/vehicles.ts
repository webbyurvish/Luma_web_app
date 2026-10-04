import { Bike, Car, CarFront, Truck, type LucideIcon } from 'lucide-react'
import { str } from '@/lib/sheetValues'
import { addDaysIso, dayDiff } from '@/lib/family'
import type { RawVehicle, RawVehicleLog, Transaction, Vehicle, VehicleInput, VehicleLog, VehicleLogInput, VehicleLogKind, VehicleType } from '@/types'

export const VEHICLE_TYPES: VehicleType[] = ['Car', 'Bike', 'Scooter', 'Auto', 'Other']
export const FUELS = ['Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid']
export const LOG_KINDS: VehicleLogKind[] = ['Fuel', 'Service', 'Repair', 'Insurance', 'PUC', 'Tyres', 'Wash', 'Toll & parking', 'Odometer', 'Other']

export const VEHICLE_ICON: Record<VehicleType, LucideIcon> = { Car: CarFront, Bike: Bike, Scooter: Bike, Auto: Car, Other: Truck }

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || str(v).trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
const day = (v: unknown) => str(v).slice(0, 10)
function bool(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value
  const s = str(value).trim().toLowerCase()
  if (s === 'false' || s === 'no') return false
  if (s === 'true' || s === 'yes') return true
  return fallback
}

export function normalizeVehicle(raw: RawVehicle): Vehicle {
  const type = str(raw.type) as VehicleType
  return {
    id: str(raw.vehicleId),
    name: str(raw.name) || 'Vehicle',
    type: VEHICLE_TYPES.includes(type) ? type : 'Car',
    registrationNumber: str(raw.registrationNumber),
    fuel: str(raw.fuel),
    owner: str(raw.owner),
    insuranceExpiry: day(raw.insuranceExpiry),
    pucExpiry: day(raw.pucExpiry),
    nextServiceDate: day(raw.nextServiceDate),
    nextServiceKm: num(raw.nextServiceKm),
    remindDaysBefore: num(raw.remindDaysBefore) ?? 15,
    isActive: bool(raw.isActive, true),
    notes: str(raw.notes) || undefined,
  }
}

export function normalizeVehicleLog(raw: RawVehicleLog): VehicleLog {
  const kind = str(raw.kind) as VehicleLogKind
  return {
    id: str(raw.logId),
    vehicleId: str(raw.vehicleId),
    date: day(raw.date),
    kind: LOG_KINDS.includes(kind) ? kind : 'Other',
    amount: num(raw.amount) ?? 0,
    odometer: num(raw.odometer),
    quantity: num(raw.quantity),
    fullTank: bool(raw.fullTank, false),
    place: str(raw.place),
    transactionId: str(raw.transactionId),
    note: str(raw.note),
  }
}

/** Blank numbers go as '' so an edit can clear them. */
export const buildVehiclePayload = (input: Partial<VehicleInput>): Record<string, unknown> => ({
  ...input,
  ...('nextServiceKm' in input ? { nextServiceKm: input.nextServiceKm ?? '' } : {}),
})
export const buildVehicleLogPayload = (input: Partial<VehicleLogInput>): Record<string, unknown> => ({
  ...input,
  ...('odometer' in input ? { odometer: input.odometer ?? '' } : {}),
  ...('quantity' in input ? { quantity: input.quantity ?? '' } : {}),
})

/* ------------------------------------------------------------ due dates */

export type DueState = 'overdue' | 'today' | 'soon' | 'ok' | 'unset'

export interface DueItem {
  key: 'insurance' | 'puc' | 'service'
  label: string
  date: string
  state: DueState
  days: number
}

function dueState(date: string, today: string, remind: number): { state: DueState; days: number } {
  if (!date) return { state: 'unset', days: Infinity }
  const days = dayDiff(today, date)
  return { state: days < 0 ? 'overdue' : days === 0 ? 'today' : days <= remind ? 'soon' : 'ok', days }
}

/** Insurance, PUC and service — each with how far away it is. */
export function vehicleDues(v: Vehicle, today: string, latestOdometer: number | null): DueItem[] {
  const items: DueItem[] = [
    { key: 'insurance', label: 'Insurance', date: v.insuranceExpiry, ...dueState(v.insuranceExpiry, today, v.remindDaysBefore) },
    { key: 'puc', label: 'PUC', date: v.pucExpiry, ...dueState(v.pucExpiry, today, v.remindDaysBefore) },
    { key: 'service', label: 'Service', date: v.nextServiceDate, ...dueState(v.nextServiceDate, today, v.remindDaysBefore) },
  ]
  // Service is also due by distance: within 500 km of the target counts as "soon".
  if (v.nextServiceKm && latestOdometer !== null) {
    const left = v.nextServiceKm - latestOdometer
    const service = items[2]
    const kmState: DueState = left <= 0 ? 'overdue' : left <= 500 ? 'soon' : 'ok'
    const rank: Record<DueState, number> = { overdue: 0, today: 1, soon: 2, ok: 3, unset: 4 }
    if (rank[kmState] < rank[service.state]) items[2] = { ...service, state: kmState, days: left <= 0 ? -1 : service.days }
  }
  return items
}

export function dueText(item: DueItem, kmLeft?: number | null): string {
  if (item.state === 'unset') return 'Not set'
  if (item.key === 'service' && kmLeft !== undefined && kmLeft !== null && (item.state === 'overdue' || item.state === 'soon') && !item.date) {
    return kmLeft <= 0 ? `${Math.abs(kmLeft).toLocaleString('en-IN')} km overdue` : `in ${kmLeft.toLocaleString('en-IN')} km`
  }
  const d = item.days
  if (d < 0) return `${-d} day${d === -1 ? '' : 's'} overdue`
  if (d === 0) return 'Today'
  if (d === 1) return 'Tomorrow'
  if (d <= 60) return `in ${d} days`
  return `in ${Math.round(d / 30)} months`
}

/** The reminder date for each paper after renewing it (insurance 1 year, PUC 6 months by default). */
export function renewalDefault(kind: 'Insurance' | 'PUC', from: string): string {
  return addDaysIso(from, kind === 'Insurance' ? 365 : 182)
}

/* ------------------------------------------------------------- running */

export function latestOdometer(logs: VehicleLog[]): number | null {
  const withOdo = logs.filter((l) => l.odometer !== null)
  if (!withOdo.length) return null
  return Math.max(...withOdo.map((l) => l.odometer!))
}

export interface RunningStats {
  /** Distance between the first and last odometer readings. */
  km: number
  /** Fuel bought after the first reading (what powered those km). */
  fuelCost: number
  costPerKm: number | null
  /** km per litre (or kg) from full-tank fills, when quantities are logged. */
  mileage: number | null
}

export function runningStats(logs: VehicleLog[]): RunningStats {
  const readings = logs.filter((l) => l.odometer !== null).sort((a, b) => a.odometer! - b.odometer!)
  if (readings.length < 2) return { km: 0, fuelCost: 0, costPerKm: null, mileage: null }
  const first = readings[0]
  const last = readings[readings.length - 1]
  const km = last.odometer! - first.odometer!
  // Fuel bought from the first reading up to (not including) the last one is what covered those km.
  const inWindow = (l: VehicleLog) =>
    l.odometer !== null ? l.odometer >= first.odometer! && l.odometer < last.odometer! : l.date >= first.date && l.date < last.date
  const fuelCost = logs.filter((l) => l.kind === 'Fuel' && inWindow(l)).reduce((s, l) => s + l.amount, 0)

  // Full-tank method: km between two full fills ÷ quantity filled at the second (and any partial fills in between).
  let mileage: number | null = null
  const fulls = logs.filter((l) => l.kind === 'Fuel' && l.fullTank && l.odometer !== null).sort((a, b) => a.odometer! - b.odometer!)
  if (fulls.length >= 2) {
    const a = fulls[0]
    const b = fulls[fulls.length - 1]
    // Every fill after the first full tank up to the last one, including fills logged without an
    // odometer (by date). One fill without a quantity makes the figure unknowable, so none is shown.
    const between = logs.filter(
      (l) =>
        l.kind === 'Fuel' &&
        l.id !== a.id &&
        (l.odometer !== null ? l.odometer > a.odometer! && l.odometer <= b.odometer! : l.date > a.date && l.date <= b.date),
    )
    const qty = between.reduce((s, l) => s + (l.quantity ?? NaN), 0)
    if (qty > 0 && b.odometer! > a.odometer!) mileage = (b.odometer! - a.odometer!) / qty
  }
  return { km, fuelCost, costPerKm: km > 0 && fuelCost > 0 ? fuelCost / km : null, mileage }
}

/* ------------------------------------------------- payments to log */

const VEHICLE_SUB = /fuel|petrol|diesel|cng|service|toll|parking|fastag|tyre|puc|car wash|vehicle|bike|garage|mechanic/i

/** Which log kind a transaction most likely is. */
export function kindForTransaction(t: Transaction): VehicleLogKind {
  const text = `${t.rawSubcategory ?? ''} ${t.merchant ?? ''}`.toLowerCase()
  if (/fuel|petrol|diesel|cng|filling|pump|petroleum|energy/.test(text)) return 'Fuel'
  if (/toll|parking|fastag/.test(text)) return 'Toll & parking'
  if (/puc|pollution/.test(text)) return 'PUC'
  if (/tyre|tire/.test(text)) return 'Tyres'
  if (/wash/.test(text)) return 'Wash'
  if (/insur/.test(text)) return 'Insurance'
  if (/service|garage|mechanic|motors|auto ?works/.test(text)) return 'Service'
  return 'Other'
}

/** Recent vehicle-looking expenses not yet in any log — fuel, tolls, service. */
export function unloggedVehiclePayments(transactions: Transaction[], logs: VehicleLog[], since: string): Transaction[] {
  const linked = new Set(logs.map((l) => l.transactionId).filter(Boolean))
  // Entries saved with "also add to my transactions" aren't linked by id; same day + amount means done.
  const typedIn = new Set(logs.filter((l) => !l.transactionId && l.amount > 0).map((l) => `${l.date}|${l.amount}`))
  return transactions
    .filter((t) => t.type === 'expense' && t.date >= since && t.sourceId && !linked.has(t.sourceId) && !typedIn.has(`${t.date}|${t.amount}`))
    .filter((t) => {
      const sub = t.rawSubcategory ?? ''
      if (VEHICLE_SUB.test(sub)) return true
      return /transport/i.test(t.rawCategory ?? '') && /petrol|petroleum|fuel|cng|filling station|pump/i.test(t.merchant ?? '')
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1))
}
