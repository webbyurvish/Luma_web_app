export interface NoteFolder {
  id: string
  name: string
  count: number
}

export interface Note {
  id: string
  title: string
  content: string
  category: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface NoteInput {
  title: string
  content: string
  category: string
  tags: string[]
}
