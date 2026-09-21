export type DocumentCategory = 'Insurance' | 'Finance' | 'Bills' | 'Personal' | 'Work' | 'Other'

export interface AppDocument {
  id: string
  name: string
  category: DocumentCategory
  date: string
  size: string
}
