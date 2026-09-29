import type { Note, NoteInput, RawNote } from '@/types'

function parseTags(raw: string | null): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

export function normalizeNote(raw: RawNote): Note {
  const now = new Date().toISOString()
  return {
    id: raw.noteId,
    title: raw.title?.trim() || 'Untitled note',
    content: raw.content ?? '',
    category: raw.category?.trim() || 'personal',
    tags: parseTags(raw.tags),
    createdAt: raw.createdAt || now,
    updatedAt: raw.updatedAt || raw.createdAt || now,
  }
}

/** Builds the POST body for a note, using the sheet's own field names. */
export function buildNotePayload(input: NoteInput): Record<string, unknown> {
  return {
    title: input.title,
    content: input.content,
    category: input.category,
    tags: input.tags.join(', '),
  }
}
