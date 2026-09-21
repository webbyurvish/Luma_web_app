export interface NoteFolder {
  id: string
  name: string
  count: number
}

export interface Note {
  id: string
  title: string
  excerpt: string
  folderId: string
  updatedAt: string
}
