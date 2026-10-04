import { uploadToFamilyFolder } from './driveUpload'
import type { OutFile } from './fileTools'

/** iPhone/Android share sheet (Save to Files, WhatsApp, Mail…) when the browser can share files. */
export function canShareFiles(files: OutFile[]): boolean {
  try {
    const list = files.map((f) => new File([f.blob], f.name, { type: f.blob.type }))
    return typeof navigator !== 'undefined' && !!navigator.canShare && navigator.canShare({ files: list })
  } catch {
    return false
  }
}

export async function shareFiles(files: OutFile[]): Promise<boolean> {
  const list = files.map((f) => new File([f.blob], f.name, { type: f.blob.type }))
  try {
    await navigator.share({ files: list })
    return true
  } catch (err) {
    // The user closing the sheet isn't an error.
    if (err instanceof DOMException && err.name === 'AbortError') return false
    throw err
  }
}

export function downloadFile(file: OutFile) {
  const url = URL.createObjectURL(file.blob)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

/** Saves into Documents → "Inbox (to sort)" (or the Luma folder when there's no inbox). */
export async function saveToDocuments(file: OutFile): Promise<string> {
  const f = new File([file.blob], file.name, { type: file.blob.type || 'application/octet-stream' })
  const saved = await uploadToFamilyFolder(f, { name: file.name.replace(/\.[^.]+$/, ''), description: 'Made with File tools', tags: 'file tools' })
  return saved.folderName
}
