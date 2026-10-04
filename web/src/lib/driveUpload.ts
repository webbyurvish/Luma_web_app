import { driveApi, getDriveTree } from '@/services/googleSheetsApi'
import { MAX_UPLOAD_BYTES } from '@/hooks/useDriveDocuments'

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(new Error("Couldn't read the file."))
    reader.readAsDataURL(file)
  })
}

/**
 * Saves a file into the family folder structure in Documents:
 * "<Person>/<a sub-folder matching `area`>" when it exists, else the person's folder, else
 * "Inbox (to sort)", else the Luma root. Returns the Drive file id and link.
 */
export async function uploadToFamilyFolder(
  file: File,
  opts: { person?: string; area?: RegExp; name: string; description?: string; tags?: string; expiryDate?: string },
): Promise<{ id: string; url: string; folderName: string }> {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('That file is over 10 MB — take a smaller photo.')
  const tree = await getDriveTree()
  const lower = (s: string) => s.trim().toLowerCase()
  const personFolder = opts.person ? tree.folders.find((f) => lower(f.name) === lower(opts.person!)) : undefined
  const areaFolder = personFolder && opts.area ? tree.folders.find((f) => f.parentId === personFolder.id && opts.area!.test(f.name)) : undefined
  const inbox = tree.folders.find((f) => /^inbox/i.test(f.name))
  const target = areaFolder ?? personFolder ?? inbox
  const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : ''
  const name = opts.name.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) + ext
  const { file: saved } = await driveApi.upload(
    target?.id ?? tree.rootId,
    { name, mimeType: file.type || 'application/octet-stream', dataBase64: await readAsBase64(file) },
    { description: opts.description ?? '', tags: opts.tags ?? '', ...(opts.expiryDate ? { expiryDate: opts.expiryDate } : {}) },
  )
  return { id: saved.id, url: saved.url, folderName: target?.name ?? 'Luma Documents' }
}
