import { useCallback, useEffect, useState } from 'react'
import { loadNotes, saveNotes } from '@/lib/noteStorage'
import type { Note, NoteInput } from '@/types'

export interface UseNotesResult {
  notes: Note[]
  createNote: (input: NoteInput) => Note
  updateNote: (id: string, input: NoteInput) => void
  deleteNote: (id: string) => void
}

export function useNotes(): UseNotesResult {
  const [notes, setNotes] = useState<Note[]>(() => loadNotes())

  useEffect(() => {
    saveNotes(notes)
  }, [notes])

  const createNote = useCallback((input: NoteInput): Note => {
    const now = new Date().toISOString()
    const note: Note = { id: crypto.randomUUID(), createdAt: now, updatedAt: now, ...input }
    setNotes((prev) => [note, ...prev])
    return note
  }, [])

  const updateNote = useCallback((id: string, input: NoteInput) => {
    setNotes((prev) => prev.map((note) => (note.id === id ? { ...note, ...input, updatedAt: new Date().toISOString() } : note)))
  }, [])

  const deleteNote = useCallback((id: string) => {
    setNotes((prev) => prev.filter((note) => note.id !== id))
  }, [])

  return { notes, createNote, updateNote, deleteNote }
}
