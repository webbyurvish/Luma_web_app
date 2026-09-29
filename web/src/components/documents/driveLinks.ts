import { File, FileArchive, FileImage, FileSpreadsheet, FileText, Presentation, type LucideIcon } from 'lucide-react'
import type { DriveFileKind } from '@/types'

/** Drive ids are URL-safe base64-ish; anything else is refused so it can't shape a URL. */
const SAFE_ID = /^[A-Za-z0-9_-]{10,}$/
const safe = (id: string) => (SAFE_ID.test(id) ? id : null)

export const driveLinks = {
  view: (id: string) => (safe(id) ? `https://drive.google.com/file/d/${id}/view` : null),
  preview: (id: string) => (safe(id) ? `https://drive.google.com/file/d/${id}/preview` : null),
  download: (id: string) => (safe(id) ? `https://drive.google.com/uc?export=download&id=${id}` : null),
  /** Needs the browser signed in to the same Google account; callers fall back to an icon. */
  thumbnail: (id: string, width = 480) => (safe(id) ? `https://drive.google.com/thumbnail?id=${id}&sz=w${width}` : null),
  folder: (id: string) => (safe(id) ? `https://drive.google.com/drive/folders/${id}` : null),
}

export const KIND_STYLE: Record<DriveFileKind, { icon: LucideIcon; tint: string }> = {
  PDF: { icon: FileText, tint: 'text-danger bg-danger-soft' },
  Image: { icon: FileImage, tint: 'text-cyan bg-cyan-soft' },
  Sheet: { icon: FileSpreadsheet, tint: 'text-success bg-success-soft' },
  Doc: { icon: FileText, tint: 'text-info bg-info-soft' },
  Slides: { icon: Presentation, tint: 'text-warning bg-warning-soft' },
  Archive: { icon: FileArchive, tint: 'text-ink-soft bg-bg-soft' },
  File: { icon: File, tint: 'text-ink-soft bg-bg-soft' },
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  const exp = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const value = bytes / 1024 ** exp
  return `${value >= 10 || exp === 0 ? Math.round(value) : value.toFixed(1)} ${units[exp]}`
}

export function splitTags(tags: string): string[] {
  return tags
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
}

export type ExpiryState = 'expired' | 'soon' | 'ok' | null

/** Expired, within 30 days, or later — relative to `today` (yyyy-MM-dd). */
export function expiryState(expiryDate: string, today: string): ExpiryState {
  if (!expiryDate) return null
  if (expiryDate < today) return 'expired'
  const soon = new Date(`${today}T00:00:00`)
  soon.setDate(soon.getDate() + 30)
  return expiryDate <= soon.toISOString().slice(0, 10) ? 'soon' : 'ok'
}
