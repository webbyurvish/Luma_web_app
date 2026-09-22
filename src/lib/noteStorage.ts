import { mockNotes } from '@/data/mockNotes'
import type { Note } from '@/types'

const STORAGE_KEY = 'luma_notes'

export function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed as Note[]
    }
  } catch {
    // fall through to seed
  }
  saveNotes(mockNotes)
  return mockNotes
}

export function saveNotes(notes: Note[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
  } catch {
    // localStorage unavailable (private mode, quota, etc.) — state still works for this session
  }
}
