/** The sheet's "Document Categories" list. */
export type DocumentCategory = 'Personal' | 'Finance' | 'Insurance' | 'Tax' | 'Work' | 'Medical' | 'Property' | 'Other'

export const DOCUMENT_CATEGORIES: DocumentCategory[] = ['Personal', 'Finance', 'Insurance', 'Tax', 'Work', 'Medical', 'Property', 'Other']

export interface AppDocument {
  id: string
  name: string
  description?: string
  category: DocumentCategory
  /** yyyy-MM-dd the record was added */
  date: string
  /** Link to the file (e.g. a Google Drive share link). */
  url?: string
  fileType?: string
  size?: string
  tags?: string
}

export interface DocumentInput {
  name: string
  description?: string
  category: DocumentCategory
  url?: string
  fileType?: string
  tags?: string
}
