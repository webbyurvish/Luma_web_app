import { useMemo } from 'react'
import {
  archiveTask as archiveTaskApi,
  createTask as createTaskApi,
  createUdhaarEntry as createUdhaarEntryApi,
  deleteTask as deleteTaskApi,
  deleteUdhaarEntry as deleteUdhaarEntryApi,
  getTasks,
  getUdhaar,
  updateTask as updateTaskApi,
  updateUdhaarEntry as updateUdhaarEntryApi,
} from '@/services/googleSheetsApi'
import {
  buildTaskCompletionPayload,
  buildTaskPayload,
  buildUdhaarCreatePayload,
  buildUdhaarFields,
  groupUdhaarByPerson,
  normalizeTask,
  normalizeUdhaarRows,
  summarizeUdhaar,
} from '@/lib/lifeAdapters'
import { useRemoteCollection } from './useFinanceCollections'
import { useDeleteAction, useRemoteList, useSyncedAction } from './useRemoteData'
import { useWithAccountResync } from './useAccountResync'
import type { Task, TaskInput, UdhaarEntry, UdhaarEntryInput, UdhaarPerson, UdhaarSummary } from '@/types'

/* ------------------------------------------------------------------ udhaar */

export interface UseUdhaarResult {
  entries: UdhaarEntry[]
  people: UdhaarPerson[]
  summary: UdhaarSummary
  loading: boolean
  refreshing: boolean
  error: string | null
  refetch: () => Promise<void>
  createEntry: (input: UdhaarEntryInput) => Promise<void>
  creating: boolean
  updateEntry: (id: string, input: UdhaarEntryInput) => Promise<void>
  updating: boolean
  deleteEntry: (id: string) => Promise<void>
  deleting: boolean
}

export function useUdhaar(): UseUdhaarResult {
  const { items: entries, loading, refreshing, error, refetch } = useRemoteList('udhaar', getUdhaar, normalizeUdhaarRows, 'Failed to load udhaar.')
  // Entries linked to an account move its balance, so writes re-sync accounts too.
  const resync = useWithAccountResync(refetch)
  const people = useMemo(() => groupUdhaarByPerson(entries), [entries])
  const summary = useMemo(() => summarizeUdhaar(people), [people])

  const [createEntry, creating] = useSyncedAction((input: UdhaarEntryInput) => createUdhaarEntryApi(buildUdhaarCreatePayload(input)), resync)
  const [updateEntry, updating] = useSyncedAction(
    (id: string, input: UdhaarEntryInput) => updateUdhaarEntryApi(id, buildUdhaarFields(input)),
    resync,
  )
  const [deleteEntry, deleting] = useDeleteAction('udhaar', 'udhaarId', deleteUdhaarEntryApi, resync)

  return { entries, people, summary, loading, refreshing, error, refetch, createEntry, creating, updateEntry, updating, deleteEntry, deleting }
}

/* ------------------------------------------------------------------- tasks */

export interface UseTasksResult {
  tasks: Task[]
  loading: boolean
  refreshing: boolean
  error: string | null
  refetch: () => Promise<void>
  createTask: (input: TaskInput) => Promise<void>
  creating: boolean
  updateTask: (id: string, input: TaskInput) => Promise<void>
  updating: boolean
  setTaskCompleted: (id: string, completed: boolean) => Promise<void>
  /** Id of the task whose checkbox is being saved, so only that row shows a spinner. */
  togglingId: string | null
  archiveTask: (id: string) => Promise<void>
  archiving: boolean
  deleteTask: (id: string) => Promise<void>
  deleting: boolean
}

export function useTasks(): UseTasksResult {
  const { items: tasks, loading, refreshing, error, refetch } = useRemoteCollection('tasks', getTasks, normalizeTask)
  const [createTask, creating] = useSyncedAction((input: TaskInput) => createTaskApi(buildTaskPayload(input)), refetch)
  const [updateTask, updating] = useSyncedAction((id: string, input: TaskInput) => updateTaskApi(id, buildTaskPayload(input)), refetch)
  const [toggle, toggling, togglingArgs] = useSyncedAction(
    (id: string, completed: boolean) => updateTaskApi(id, buildTaskCompletionPayload(completed)),
    refetch,
  )
  const [archiveTask, archiving] = useSyncedAction((id: string) => archiveTaskApi(id), refetch)
  const [deleteTask, deleting] = useDeleteAction('tasks', 'taskId', deleteTaskApi, refetch)

  return {
    tasks,
    loading,
    refreshing,
    error,
    refetch,
    createTask,
    creating,
    updateTask,
    updating,
    setTaskCompleted: toggle,
    togglingId: toggling ? (togglingArgs?.[0] ?? null) : null,
    archiveTask,
    archiving,
    deleteTask,
    deleting,
  }
}
