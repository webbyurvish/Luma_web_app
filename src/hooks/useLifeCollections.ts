import { useMemo } from 'react'
import {
  archiveDocument as archiveDocumentApi,
  archiveTask as archiveTaskApi,
  createDocument as createDocumentApi,
  createTask as createTaskApi,
  createUdhaarEntry as createUdhaarEntryApi,
  deleteDocument as deleteDocumentApi,
  deleteTask as deleteTaskApi,
  deleteUdhaarEntry as deleteUdhaarEntryApi,
  getDocuments,
  getTasks,
  getUdhaar,
  updateDocument as updateDocumentApi,
  updateTask as updateTaskApi,
  updateUdhaarEntry as updateUdhaarEntryApi,
} from '@/services/googleSheetsApi'
import {
  buildDocumentPayload,
  buildTaskCompletionPayload,
  buildTaskPayload,
  buildUdhaarCreatePayload,
  buildUdhaarFields,
  groupUdhaarByPerson,
  normalizeDocument,
  normalizeTask,
  normalizeUdhaarRows,
  summarizeUdhaar,
} from '@/lib/lifeAdapters'
import { useRemoteCollection } from './useFinanceCollections'
import { useDeleteAction, useRemoteList, useSyncedAction } from './useRemoteData'
import type { AppDocument, DocumentInput, Task, TaskInput, UdhaarEntry, UdhaarEntryInput, UdhaarPerson, UdhaarSummary } from '@/types'

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
  const people = useMemo(() => groupUdhaarByPerson(entries), [entries])
  const summary = useMemo(() => summarizeUdhaar(people), [people])

  const [createEntry, creating] = useSyncedAction((input: UdhaarEntryInput) => createUdhaarEntryApi(buildUdhaarCreatePayload(input)), refetch)
  const [updateEntry, updating] = useSyncedAction(
    (id: string, input: UdhaarEntryInput) => updateUdhaarEntryApi(id, buildUdhaarFields(input)),
    refetch,
  )
  const [deleteEntry, deleting] = useDeleteAction('udhaar', 'udhaarId', deleteUdhaarEntryApi, refetch)

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

/* --------------------------------------------------------------- documents */

export interface UseDocumentsResult {
  documents: AppDocument[]
  loading: boolean
  refreshing: boolean
  error: string | null
  refetch: () => Promise<void>
  createDocument: (input: DocumentInput) => Promise<void>
  creating: boolean
  updateDocument: (id: string, input: DocumentInput) => Promise<void>
  updating: boolean
  archiveDocument: (id: string) => Promise<void>
  archiving: boolean
  deleteDocument: (id: string) => Promise<void>
  deleting: boolean
}

export function useDocuments(): UseDocumentsResult {
  const { items: documents, loading, refreshing, error, refetch } = useRemoteCollection('documents', getDocuments, normalizeDocument)
  const [createDocument, creating] = useSyncedAction((input: DocumentInput) => createDocumentApi(buildDocumentPayload(input)), refetch)
  const [updateDocument, updating] = useSyncedAction(
    (id: string, input: DocumentInput) => updateDocumentApi(id, buildDocumentPayload(input)),
    refetch,
  )
  const [archiveDocument, archiving] = useSyncedAction((id: string) => archiveDocumentApi(id), refetch)
  const [deleteDocument, deleting] = useDeleteAction('documents', 'documentId', deleteDocumentApi, refetch)

  return { documents, loading, refreshing, error, refetch, createDocument, creating, updateDocument, updating, archiveDocument, archiving, deleteDocument, deleting }
}
