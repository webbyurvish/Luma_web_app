/** What the AI made of one photo (mirrors LUMA_SNAP_SCHEMA in apps-script/Luma_AI.js). */
export type SnapKind = 'bill' | 'expense' | 'medical_bill' | 'prescription' | 'event' | 'document' | 'contact' | 'note' | 'unreadable'

export interface SnapMedicine {
  name: string
  dose: string | null
  timing: string | null
  days: number | null
}

export interface SnapResult {
  kind: SnapKind
  title: string | null
  summary: string | null
  amount: number | null
  date: string | null
  dueDate: string | null
  expiryDate: string | null
  category: string | null
  subcategory: string | null
  merchant: string | null
  person: string | null
  reference: string | null
  paymentMethod: string | null
  medicines: SnapMedicine[]
  contactName: string | null
  phone: string | null
  email: string | null
  company: string | null
  text: string | null
  confidence: number
}

/** The kinds a user can switch between, with what saving does for each. */
export const SNAP_KINDS: { kind: Exclude<SnapKind, 'unreadable'>; label: string; action: string }[] = [
  { kind: 'bill', label: 'Bill to pay', action: 'Add bill reminder' },
  { kind: 'expense', label: 'Paid receipt', action: 'Add expense' },
  { kind: 'medical_bill', label: 'Medical bill', action: 'Save to Health' },
  { kind: 'prescription', label: 'Prescription', action: 'Save prescription' },
  { kind: 'event', label: 'Date / event', action: 'Add to tasks' },
  { kind: 'document', label: 'Keep document', action: 'Save to Documents' },
  { kind: 'contact', label: 'Contact', action: 'Save contact' },
  { kind: 'note', label: 'Note', action: 'Save note' },
]

/** Kinds where the photo itself is worth keeping by default. */
export const KEEP_PHOTO_BY_DEFAULT = new Set<SnapKind>(['document', 'prescription', 'medical_bill'])

/**
 * Shrinks a phone photo to at most `maxSide` px on its long edge as JPEG — a 4 MB iPhone photo
 * becomes ~250 KB, which is quicker to send and still sharp enough to read small print.
 */
export async function shrinkPhoto(file: File, maxSide = 1600, quality = 0.82): Promise<{ dataUrl: string; file: File }> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error("That file isn't a photo Luma can open. Try a JPG or PNG."))
      el.src = url
    })
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error("Couldn't prepare the photo on this device.")
    ctx.fillStyle = '#ffffff' // transparent PNG screenshots become white, not black
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't prepare the photo."))), 'image/jpeg', quality))
    const dataUrl = canvas.toDataURL('image/jpeg', quality)
    const base = file.name.replace(/\.[^.]+$/, '') || 'photo'
    return { dataUrl, file: new File([blob], `${base}.jpg`, { type: 'image/jpeg' }) }
  } finally {
    URL.revokeObjectURL(url)
  }
}

const isoOk = (v: string | null | undefined): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v)
export const isoOrEmpty = (v: string | null | undefined) => (isoOk(v) ? v : '')

/** Prescription as readable note text. */
export function prescriptionText(r: SnapResult): string {
  const lines = r.medicines.map((m) => `• ${m.name}${m.dose ? ` ${m.dose}` : ''}${m.timing ? ` — ${m.timing}` : ''}${m.days ? ` for ${m.days} day${m.days === 1 ? '' : 's'}` : ''}`)
  return [...lines, r.text && !lines.length ? r.text : ''].filter(Boolean).join('\n')
}

export function contactText(r: SnapResult): string {
  return [r.company && `Company: ${r.company}`, r.phone && `Phone: ${r.phone}`, r.email && `Email: ${r.email}`, r.summary].filter(Boolean).join('\n')
}
