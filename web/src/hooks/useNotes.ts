import {
  archiveNote as archiveNoteApi,
  createNote as createNoteApi,
  deleteNote as deleteNoteApi,
  getNotes,
  updateNote as updateNoteApi,
} from '@/services/googleSheetsApi'
import { buildNotePayload, normalizeNote } from '@/lib/noteAdapters'
import { useRemoteCollection } from './useFinanceCollections'
import { useDeleteAction, useSyncedAction } from './useRemoteData'
import type { Note, NoteInput } from '@/types'

export interface UseNotesResult {
  notes: Note[]
  loading: boolean
  refreshing: boolean
  error: string | null
  refetch: () => Promise<void>
  createNote: (input: NoteInput) => Promise<void>
  creating: boolean
  updateNote: (id: string, input: NoteInput) => Promise<void>
  updating: boolean
  archiveNote: (id: string) => Promise<void>
  archiving: boolean
  deleteNote: (id: string) => Promise<void>
  deleting: boolean
}

export function useNotes(): UseNotesResult {
  const { items, loading, refreshing, error, refetch } = useRemoteCollection('notes', getNotes, normalizeNote)
  const [createNote, creating] = useSyncedAction((input: NoteInput) => createNoteApi(buildNotePayload(input)), refetch)
  const [updateNote, updating] = useSyncedAction((id: string, input: NoteInput) => updateNoteApi(id, buildNotePayload(input)), refetch)
  const [archiveNote, archiving] = useSyncedAction((id: string) => archiveNoteApi(id), refetch)
  const [deleteNote, deleting] = useDeleteAction('notes', 'noteId', deleteNoteApi, refetch)

  return { notes: items, loading, refreshing, error, refetch, createNote, creating, updateNote, updating, archiveNote, archiving, deleteNote, deleting }
}
