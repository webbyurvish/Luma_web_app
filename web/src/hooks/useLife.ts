import { useMemo } from 'react'
import {
  createLifeBulk,
  createMedicalBill as createMedicalBillApi,
  createVehicle as createVehicleApi,
  createVehicleLog as createVehicleLogApi,
  deleteMedicalBill as deleteMedicalBillApi,
  deleteVehicle as deleteVehicleApi,
  deleteVehicleLog as deleteVehicleLogApi,
  getMedicalBills,
  getVehicleLogs,
  getVehicles,
  updateMedicalBill as updateMedicalBillApi,
  updateVehicle as updateVehicleApi,
  updateVehicleLog as updateVehicleLogApi,
} from '@/services/googleSheetsApi'
import { buildVehicleLogPayload, buildVehiclePayload, normalizeVehicle, normalizeVehicleLog } from '@/lib/vehicles'
import { buildMedicalPayload, normalizeMedicalBill } from '@/lib/medical'
import { useRemoteCollection } from './useFinanceCollections'
import { useDeleteAction, useSyncedAction } from './useRemoteData'
import { useImportantDates, useRecharges } from './useFamily'
import type { MedicalBillInput, VehicleInput, VehicleLogInput } from '@/types'

export function useVehicles() {
  const { items: vehicles, loading, refreshing, error, refetch } = useRemoteCollection('vehicles', getVehicles, normalizeVehicle)
  const [createVehicle, creating] = useSyncedAction((input: VehicleInput) => createVehicleApi(buildVehiclePayload(input)), refetch)
  const [updateVehicle, updating] = useSyncedAction((id: string, input: Partial<VehicleInput>) => updateVehicleApi(id, buildVehiclePayload(input)), refetch)
  const [deleteVehicle, deleting] = useDeleteAction('vehicles', 'vehicleId', deleteVehicleApi, refetch)
  return { vehicles, loading, refreshing, error, refetch, createVehicle, creating, updateVehicle, updating, deleteVehicle, deleting }
}

export function useVehicleLogs() {
  const { items: logs, loading, refreshing, error, refetch } = useRemoteCollection('vehiclelogs', getVehicleLogs, normalizeVehicleLog)
  const [createLog, creating] = useSyncedAction((input: VehicleLogInput) => createVehicleLogApi(buildVehicleLogPayload(input)), refetch)
  const [createLogs, bulkSaving] = useSyncedAction((inputs: VehicleLogInput[]) => createLifeBulk('vehiclelog', inputs.map(buildVehicleLogPayload)), refetch)
  const [updateLog, updating] = useSyncedAction((id: string, input: Partial<VehicleLogInput>) => updateVehicleLogApi(id, buildVehicleLogPayload(input)), refetch)
  const [deleteLog, deleting] = useDeleteAction('vehiclelogs', 'logId', deleteVehicleLogApi, refetch)
  return { logs, loading, refreshing, error, refetch, createLog, creating, createLogs, bulkSaving, updateLog, updating, deleteLog, deleting }
}

export function useMedicalBills() {
  const { items: bills, loading, refreshing, error, refetch } = useRemoteCollection('medicalbills', getMedicalBills, normalizeMedicalBill)
  const [createBill, creating] = useSyncedAction((input: MedicalBillInput) => createMedicalBillApi(buildMedicalPayload(input)), refetch)
  const [updateBill, updating] = useSyncedAction((id: string, input: Partial<MedicalBillInput>) => updateMedicalBillApi(id, buildMedicalPayload(input)), refetch)
  const [deleteBill, deleting] = useDeleteAction('medicalbills', 'billId', deleteMedicalBillApi, refetch)
  return { bills, loading, refreshing, error, refetch, createBill, creating, updateBill, updating, deleteBill, deleting }
}

/** Names already used across Family, Health and Vehicles, so "Mom" stays "Mom" everywhere. */
export function useKnownPeople(extra: string[] = []): string[] {
  const { dates } = useImportantDates()
  const { recharges } = useRecharges()
  const key = extra.join('|')
  return useMemo(
    () => [...new Set([...dates.map((d) => d.person), ...recharges.map((r) => r.person), ...key.split('|'), 'Me', 'Mom', 'Dad'].map((p) => p.trim()).filter(Boolean))].sort(),
    [dates, recharges, key],
  )
}
