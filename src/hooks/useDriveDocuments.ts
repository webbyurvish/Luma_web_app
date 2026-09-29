import { useCallback, useMemo, useRef, useState } from 'react'
import { driveApi, getDriveTree } from '@/services/googleSheetsApi'
import { useRemoteList, useSyncedAction } from './useRemoteData'
import type { DriveFile, DriveFileDetails, DriveFolder, DriveTree } from '@/types'

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

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

  const [createFolder, creatingFolder] = useSyncedAction((parentId: string, name: string) => driveApi.createFolder(parentId, name), refetch)
  const [renameFolder, renamingFolder] = useSyncedAction((folderId: string, name: string) => driveApi.renameFolder(folderId, name), refetch)
  const [moveFolder, movingFolder] = useSyncedAction((folderId: string, targetId: string) => driveApi.moveFolder(folderId, targetId), refetch)
  const [trashFolder, trashingFolder] = useSyncedAction((folderId: string) => driveApi.trashFolder(folderId), refetch)
  const [updateFile, updatingFile] = useSyncedAction((fileId: string, details: Partial<DriveFileDetails>) => driveApi.updateFile(fileId, details), refetch)
  const [moveFile, movingFile] = useSyncedAction((fileId: string, folderId: string) => driveApi.moveFile(fileId, folderId), refetch)
  const [trashFile, trashingFile] = useSyncedAction((fileId: string) => driveApi.trashFile(fileId), refetch)

  /* Uploads run one at a time (Apps Script is slow with parallel requests), then one refresh. */
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
        await driveApi.upload(item.folderId, { name: file.name, mimeType: file.type || 'application/octet-stream', dataBase64 })
        patch(item.id, { status: 'done' })
        uploadedAny = true
      } catch (err) {
        patch(item.id, { status: 'error', error: err instanceof Error ? err.message : 'Upload failed.' })
      }
    }
    runningRef.current = false
    if (uploadedAny) await refetch()
  }, [refetch])

  /** Queues files for upload into `folderId`; oversized files are rejected up front. */
  const uploadFiles = useCallback(
    (files: File[], folderId: string) => {
      const added: UploadItem[] = files.map((file) => ({
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        folderId,
        status: file.size > MAX_UPLOAD_BYTES ? 'error' : file.size === 0 ? 'error' : 'queued',
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
    renameFolder,
    moveFolder,
    trashFolder,
    updateFile,
    moveFile,
    trashFile,
    folderBusy: creatingFolder || renamingFolder || movingFolder || trashingFolder,
    fileBusy: updatingFile || movingFile || trashingFile,
    uploads,
    uploadFiles,
    clearFinishedUploads,
  }
}
