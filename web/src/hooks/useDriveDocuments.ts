import { useCallback, useMemo, useRef, useState } from 'react'
import { driveApi, getDriveTree } from '@/services/googleSheetsApi'
import { mutateLocal } from '@/lib/remoteStore'
import { useRemoteList } from './useRemoteData'
import type { DriveFile, DriveFileDetails, DriveFolder, DriveTree } from '@/types'
import type { FolderSpec } from '@/lib/familyFolders'

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

/** Folders created optimistically carry this prefix until Drive returns the real id. */
export const PENDING_PREFIX = 'pending-'
export const isPending = (id: string) => id.startsWith(PENDING_PREFIX)

// The store holds lists; the tree travels as a one-item list.
const fetchTree = async (): Promise<DriveTree[]> => [await getDriveTree()]
const identity = (rows: DriveTree[]) => rows

export interface UploadItem {
  id: string
  name: string
  size: number
  folderId: string
  status: 'queued' | 'uploading' | 'done' | 'error'
  error?: string
}

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(new Error("Couldn't read the file."))
    reader.readAsDataURL(file)
  })
}

/** Applies an edit to the on-screen tree immediately; returns its undo. */
const editTree = (fn: (tree: DriveTree) => DriveTree) => mutateLocal('drive', (rows) => (rows as DriveTree[]).map(fn))

function descendantIds(tree: DriveTree, folderId: string): Set<string> {
  const ids = new Set([folderId])
  let grew = true
  while (grew) {
    grew = false
    tree.folders.forEach((f) => {
      if (f.parentId && ids.has(f.parentId) && !ids.has(f.id)) {
        ids.add(f.id)
        grew = true
      }
    })
  }
  return ids
}

export function useDriveDocuments() {
  const { items, loading, refreshing, error, refetch } = useRemoteList('drive', fetchTree, identity, "Couldn't load your documents.")
  const tree: DriveTree | null = items[0] ?? null

  const indexes = useMemo(() => {
    const folderById = new Map<string, DriveFolder>()
    const childFolders = new Map<string, DriveFolder[]>()
    const filesIn = new Map<string, DriveFile[]>()
    tree?.folders.forEach((f) => {
      folderById.set(f.id, f)
      if (f.parentId) childFolders.set(f.parentId, [...(childFolders.get(f.parentId) ?? []), f])
    })
    childFolders.forEach((list) => list.sort((a, b) => a.name.localeCompare(b.name)))
    tree?.files.forEach((f) => filesIn.set(f.folderId, [...(filesIn.get(f.folderId) ?? []), f]))
    filesIn.forEach((list) => list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))

    /** Folder chain from the root to `id`, inclusive. */
    const pathTo = (id: string): DriveFolder[] => {
      const chain: DriveFolder[] = []
      let current = folderById.get(id)
      for (let guard = 0; current && guard < 30; guard++) {
        chain.unshift(current)
        current = current.parentId ? folderById.get(current.parentId) : undefined
      }
      return chain
    }
    /** Every file under `id`, at any depth. */
    const countDeep = (id: string): number =>
      (filesIn.get(id)?.length ?? 0) + (childFolders.get(id) ?? []).reduce((sum, child) => sum + countDeep(child.id), 0)

    return { folderById, childFolders, filesIn, pathTo, countDeep }
  }, [tree])

  /**
   * Optimistic write: the tree changes on screen at once, Drive is updated in the background,
   * and a quiet re-sync follows. If Drive refuses, the change is rolled back and the error thrown.
   */
  const optimistic = useCallback(
    async <T>(apply: (tree: DriveTree) => DriveTree, call: () => Promise<T>): Promise<T> => {
      const undo = editTree(apply)
      try {
        const result = await call()
        void refetch()
        return result
      } catch (err) {
        undo()
        throw err
      }
    },
    [refetch],
  )

  const createFolder = useCallback(
    async (parentId: string, name: string) => {
      const tempId = `${PENDING_PREFIX}${crypto.randomUUID()}`
      const temp: DriveFolder = { id: tempId, name, parentId, createdAt: new Date().toISOString() }
      const { folder } = await optimistic((t) => ({ ...t, folders: [...t.folders, temp] }), () => driveApi.createFolder(parentId, name))
      // Swap the placeholder for the real folder (unless a re-sync already did).
      editTree((t) => ({ ...t, folders: t.folders.map((f) => (f.id === tempId ? { ...folder, createdAt: temp.createdAt } : f)) }))
      return folder
    },
    [optimistic],
  )

  /** Builds a nested structure (e.g. the family template) under parentId in one request. */
  const createTree = useCallback(
    async (parentId: string, spec: FolderSpec[]) => {
      let result
      try {
        result = await driveApi.createTree(parentId, spec)
      } catch (err) {
        // An older script deployment doesn't know this operation yet.
        if (err instanceof Error && /Unknown document operation/.test(err.message)) {
          throw new Error('Deploy the latest Apps Script version first (clasp push → Deploy → New version), then try again.')
        }
        throw err
      }
      editTree((t) => {
        const known = new Set(t.folders.map((f) => f.id))
        return { ...t, folders: [...t.folders, ...result.folders.filter((f) => !known.has(f.id))] }
      })
      void refetch()
      return result
    },
    [refetch],
  )

  const renameFolder = useCallback(
    (folderId: string, name: string) =>
      optimistic((t) => ({ ...t, folders: t.folders.map((f) => (f.id === folderId ? { ...f, name } : f)) }), () => driveApi.renameFolder(folderId, name)),
    [optimistic],
  )

  const moveFolder = useCallback(
    (folderId: string, targetId: string) =>
      optimistic(
        (t) => ({ ...t, folders: t.folders.map((f) => (f.id === folderId ? { ...f, parentId: targetId } : f)) }),
        () => driveApi.moveFolder(folderId, targetId),
      ),
    [optimistic],
  )

  const trashFolder = useCallback(
    (folderId: string) =>
      optimistic(
        (t) => {
          const gone = descendantIds(t, folderId)
          return { ...t, folders: t.folders.filter((f) => !gone.has(f.id)), files: t.files.filter((f) => !gone.has(f.folderId)) }
        },
        () => driveApi.trashFolder(folderId),
      ),
    [optimistic],
  )

  const updateFile = useCallback(
    (fileId: string, details: Partial<DriveFileDetails>) =>
      optimistic((t) => ({ ...t, files: t.files.map((f) => (f.id === fileId ? { ...f, ...details } : f)) }), () => driveApi.updateFile(fileId, details)),
    [optimistic],
  )

  const moveFile = useCallback(
    (fileId: string, folderId: string) =>
      optimistic((t) => ({ ...t, files: t.files.map((f) => (f.id === fileId ? { ...f, folderId } : f)) }), () => driveApi.moveFile(fileId, folderId)),
    [optimistic],
  )

  const trashFile = useCallback(
    (fileId: string) => optimistic((t) => ({ ...t, files: t.files.filter((f) => f.id !== fileId) }), () => driveApi.trashFile(fileId)),
    [optimistic],
  )

  /* Uploads run one at a time (Apps Script is slow with parallel requests); each finished file
   * appears straight away, and one quiet re-sync runs at the end. */
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const queueRef = useRef<{ item: UploadItem; file: File }[]>([])
  const runningRef = useRef(false)

  const patch = (id: string, change: Partial<UploadItem>) => setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, ...change } : u)))

  const drain = useCallback(async () => {
    if (runningRef.current) return
    runningRef.current = true
    let uploadedAny = false
    while (queueRef.current.length) {
      const { item, file } = queueRef.current.shift()!
      patch(item.id, { status: 'uploading' })
      try {
        const dataBase64 = await readAsBase64(file)
        const { file: saved } = await driveApi.upload(item.folderId, { name: file.name, mimeType: file.type || 'application/octet-stream', dataBase64 })
        if (saved?.id) editTree((t) => ({ ...t, files: [...t.files.filter((f) => f.id !== saved.id), saved] }))
        patch(item.id, { status: 'done' })
        uploadedAny = true
      } catch (err) {
        patch(item.id, { status: 'error', error: err instanceof Error ? err.message : 'Upload failed.' })
      }
    }
    runningRef.current = false
    if (uploadedAny) void refetch()
  }, [refetch])

  /** Queues files for upload into `folderId`; oversized or empty files are rejected up front. */
  const uploadFiles = useCallback(
    (files: File[], folderId: string) => {
      const added: UploadItem[] = files.map((file) => ({
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        folderId,
        status: file.size > MAX_UPLOAD_BYTES || file.size === 0 ? 'error' : 'queued',
        error: file.size > MAX_UPLOAD_BYTES ? 'Over 10 MB — upload this one in Google Drive directly.' : file.size === 0 ? 'The file is empty.' : undefined,
      }))
      setUploads((prev) => [...prev, ...added])
      added.forEach((item, i) => item.status === 'queued' && queueRef.current.push({ item, file: files[i] }))
      void drain()
    },
    [drain],
  )

  const clearFinishedUploads = useCallback(() => setUploads((prev) => prev.filter((u) => u.status === 'queued' || u.status === 'uploading')), [])

  return {
    tree,
    ...indexes,
    loading,
    refreshing,
    error,
    refetch,
    createFolder,
    createTree,
    renameFolder,
    moveFolder,
    trashFolder,
    updateFile,
    moveFile,
    trashFile,
    uploads,
    uploadFiles,
    clearFinishedUploads,
  }
}
