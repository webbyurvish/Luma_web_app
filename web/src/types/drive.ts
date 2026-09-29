/** A folder inside "Luma Documents" (the root has parentId null). */
export interface DriveFolder {
  id: string
  name: string
  parentId: string | null
  createdAt: string
}

export type DriveFileKind = 'PDF' | 'Image' | 'Sheet' | 'Doc' | 'Slides' | 'Archive' | 'File'

/** A file in Drive plus the details Luma keeps for it in the Documents sheet. */
export interface DriveFile {
  id: string
  name: string
  folderId: string
  mimeType: string
  kind: DriveFileKind
  size: number
  createdAt: string
  updatedAt: string
  url: string
  description: string
  tags: string
  /** yyyy-MM-dd, or '' */
  expiryDate: string
}

export interface DriveTree {
  rootId: string
  rootUrl: string
  folders: DriveFolder[]
  files: DriveFile[]
}

/** Editable details of a file. */
export interface DriveFileDetails {
  name: string
  description: string
  tags: string
  expiryDate: string
}
