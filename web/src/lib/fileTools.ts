import { openPdf, renderPage } from './pdfjs'

/**
 * File tools that run entirely on the phone: nothing is uploaded. pdf-lib (building PDFs) and
 * fflate (ZIP) load only when a tool is used.
 */

export interface OutFile {
  name: string
  blob: Blob
}

const pdfLib = () => import('pdf-lib')

export const baseName = (name: string) => name.replace(/\.[^.]+$/, '') || 'file'
export const isPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name)
export const isImage = (f: File) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif|gif|bmp)$/i.test(f.name)

function pdfBlob(bytes: Uint8Array): Blob {
  return new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' })
}

/** pdf-lib refuses encrypted PDFs; say so in plain words. */
async function loadForEdit(file: File | Uint8Array) {
  const { PDFDocument, EncryptedPDFError } = await pdfLib()
  const bytes = file instanceof Uint8Array ? file : new Uint8Array(await file.arrayBuffer())
  try {
    return await PDFDocument.load(bytes, { updateMetadata: false })
  } catch (err) {
    if (err instanceof EncryptedPDFError || (err instanceof Error && /encrypt/i.test(err.message))) throw new Error('This PDF is password-protected. Open it, remove the password (or print it to a new PDF), then try again.')
    throw new Error("This doesn't look like a readable PDF.")
  }
}

/* ------------------------------------------------------------- images */

/** Decodes any photo the browser can show (incl. HEIC on iPhone), upright, on white. */
async function drawImage(file: File | Blob, maxSide = 0): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error(`${file instanceof File ? file.name : 'That image'} can't be opened on this device.`))
      el.src = url
    })
    const scale = maxSide ? Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight)) : 1
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas
  } finally {
    URL.revokeObjectURL(url)
  }
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't create the image."))), type, quality))
}

export type PageSize = 'a4' | 'letter' | 'fit'
const PAGE_POINTS = { a4: [595.28, 841.89], letter: [612, 792] } as const

/** Photos → one PDF. A4/Letter pages turn landscape for landscape photos; 'fit' = page the size of the photo. */
export async function imagesToPdf(files: File[], opts: { pageSize: PageSize; margin: number; quality: number }, onStep?: (i: number) => void): Promise<Blob> {
  const { PDFDocument } = await pdfLib()
  const pdf = await PDFDocument.create()
  for (let i = 0; i < files.length; i++) {
    onStep?.(i)
    const canvas = await drawImage(files[i], 2400)
    const jpg = await canvasBlob(canvas, 'image/jpeg', opts.quality)
    const image = await pdf.embedJpg(new Uint8Array(await jpg.arrayBuffer()))
    const landscape = image.width > image.height
    let [pw, ph] = opts.pageSize === 'fit' ? [image.width * 0.75, image.height * 0.75] : PAGE_POINTS[opts.pageSize]
    if (opts.pageSize !== 'fit' && landscape) [pw, ph] = [ph, pw]
    const page = pdf.addPage([pw, ph])
    const m = opts.pageSize === 'fit' ? 0 : opts.margin
    const s = Math.min((pw - 2 * m) / image.width, (ph - 2 * m) / image.height)
    const w = image.width * s
    const h = image.height * s
    page.drawImage(image, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h })
  }
  return pdfBlob(await pdf.save())
}

export type ImageFormat = 'jpeg' | 'png' | 'webp'

/** Re-saves an image in another format. Returns null when this browser can't write that format. */
export async function convertImage(file: File, format: ImageFormat, quality: number): Promise<OutFile | null> {
  const canvas = await drawImage(file)
  const type = `image/${format}`
  const blob = await canvasBlob(canvas, type, format === 'png' ? undefined : quality)
  if (blob.type !== type) return null // e.g. older iPhones can't write WebP
  return { name: `${baseName(file.name)}.${format === 'jpeg' ? 'jpg' : format}`, blob }
}

/* --------------------------------------------------------------- PDFs */

export async function pageCount(file: File): Promise<number> {
  return (await loadForEdit(file)).getPageCount()
}

export async function mergePdfs(files: File[], onStep?: (i: number) => void): Promise<Blob> {
  const { PDFDocument } = await pdfLib()
  const out = await PDFDocument.create()
  for (let i = 0; i < files.length; i++) {
    onStep?.(i)
    const src = await loadForEdit(files[i])
    const pages = await out.copyPages(src, src.getPageIndices())
    pages.forEach((p) => out.addPage(p))
  }
  return pdfBlob(await out.save())
}

export interface PagePlan {
  /** 0-based page in the source. */
  index: number
  /** Extra rotation in degrees (0/90/180/270). */
  rotate: number
}

/** A new PDF with the pages in this order and rotation (the Organise tool). */
export async function buildFromPlan(file: File, plan: PagePlan[]): Promise<Blob> {
  const { PDFDocument, degrees } = await pdfLib()
  const src = await loadForEdit(file)
  const out = await PDFDocument.create()
  const pages = await out.copyPages(src, plan.map((p) => p.index))
  pages.forEach((page, i) => {
    const extra = plan[i].rotate
    if (extra) page.setRotation(degrees((page.getRotation().angle + extra) % 360))
    out.addPage(page)
  })
  return pdfBlob(await out.save())
}

/** "1-3, 5, 8-10" → [[1,2,3],[5],[8,9,10]] (1-based). Throws a readable message on bad input. */
export function parseRanges(text: string, total: number): number[][] {
  const parts = text.split(/[,;]+/).map((p) => p.trim()).filter(Boolean)
  if (!parts.length) throw new Error('Type the pages, e.g. 1-3, 5, 8-10.')
  return parts.map((part) => {
    const m = /^(\d+)\s*(?:-|to)\s*(\d+)$/i.exec(part) ?? /^(\d+)$/.exec(part)
    if (!m) throw new Error(`"${part}" isn't a page or a range like 2-5.`)
    const a = Number(m[1])
    const b = Number(m[2] ?? m[1])
    if (a < 1 || b < 1 || a > total || b > total) throw new Error(`This PDF has ${total} page${total === 1 ? '' : 's'}; "${part}" is outside that.`)
    const [lo, hi] = a <= b ? [a, b] : [b, a]
    return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
  })
}

export async function splitPdf(file: File, groups: number[][]): Promise<OutFile[]> {
  const { PDFDocument } = await pdfLib()
  const src = await loadForEdit(file)
  const base = baseName(file.name)
  const out: OutFile[] = []
  for (const group of groups) {
    const doc = await PDFDocument.create()
    const pages = await doc.copyPages(src, group.map((n) => n - 1))
    pages.forEach((p) => doc.addPage(p))
    const label = group.length === 1 ? `page ${group[0]}` : `pages ${group[0]}-${group[group.length - 1]}`
    out.push({ name: `${base} (${label}).pdf`, blob: pdfBlob(await doc.save()) })
  }
  return out
}

/** Small page pictures for the Organise screen. */
export async function pdfThumbnails(file: File, onPage?: (n: number, total: number) => void): Promise<string[]> {
  const { doc, close } = await openPdf(await file.arrayBuffer())
  try {
    const thumbs: string[] = []
    for (let n = 1; n <= doc.numPages; n++) {
      onPage?.(n, doc.numPages)
      const first = await doc.getPage(n)
      const scale = 180 / first.getViewport({ scale: 1 }).width
      const canvas = await renderPage(doc, n, scale)
      thumbs.push(canvas.toDataURL('image/jpeg', 0.7))
    }
    return thumbs
  } finally {
    await close()
  }
}

/** Every page as a picture. dpi 150 is sharp on a phone; 300 for printing. */
export async function pdfToImages(file: File, opts: { format: 'jpeg' | 'png'; dpi: number }, onPage?: (n: number, total: number) => void): Promise<OutFile[]> {
  const { doc, close } = await openPdf(await file.arrayBuffer())
  try {
    const out: OutFile[] = []
    const base = baseName(file.name)
    for (let n = 1; n <= doc.numPages; n++) {
      onPage?.(n, doc.numPages)
      const canvas = await renderPage(doc, n, opts.dpi / 72)
      const blob = await canvasBlob(canvas, `image/${opts.format}`, opts.format === 'jpeg' ? 0.9 : undefined)
      out.push({ name: `${base} - page ${n}.${opts.format === 'jpeg' ? 'jpg' : 'png'}`, blob })
      canvas.width = canvas.height = 0
    }
    return out
  } finally {
    await close()
  }
}

/**
 * Shrinks a PDF towards `targetBytes` by redrawing every page as a JPEG, stepping resolution and
 * quality down until it fits. Pages become pictures (text can no longer be selected) — fine for
 * scans and form uploads, which is what size limits are about.
 */
export async function compressPdf(file: File, targetBytes: number, onStep?: (label: string) => void): Promise<{ blob: Blob; reached: boolean }> {
  const { PDFDocument } = await pdfLib()
  const { doc, close } = await openPdf(await file.arrayBuffer())
  const steps = [
    { dpi: 150, q: 0.75 },
    { dpi: 120, q: 0.65 },
    { dpi: 100, q: 0.55 },
    { dpi: 85, q: 0.45 },
    { dpi: 72, q: 0.38 },
    { dpi: 60, q: 0.3 },
  ]
  let best: Blob | null = null
  try {
    for (const step of steps) {
      onStep?.(`Trying ${step.dpi} dpi…`)
      const out = await PDFDocument.create()
      for (let n = 1; n <= doc.numPages; n++) {
        const page = await doc.getPage(n)
        const vp = page.getViewport({ scale: 1 })
        const canvas = await renderPage(doc, n, step.dpi / 72)
        const jpg = await canvasBlob(canvas, 'image/jpeg', step.q)
        canvas.width = canvas.height = 0
        const image = await out.embedJpg(new Uint8Array(await jpg.arrayBuffer()))
        out.addPage([vp.width, vp.height]).drawImage(image, { x: 0, y: 0, width: vp.width, height: vp.height })
      }
      const blob = pdfBlob(await out.save())
      if (!best || blob.size < best.size) best = blob
      if (blob.size <= targetBytes) return { blob, reached: true }
    }
    return { blob: best!, reached: false }
  } finally {
    await close()
  }
}

/* ---------------------------------------------------------------- ZIP */

export async function zipFiles(files: OutFile[], name: string): Promise<OutFile> {
  const { zipSync } = await import('fflate')
  const entries: Record<string, Uint8Array> = {}
  const used = new Set<string>()
  for (const f of files) {
    let n = f.name
    for (let i = 2; used.has(n); i++) n = f.name.replace(/(\.[^.]+)?$/, ` (${i})$1`)
    used.add(n)
    entries[n] = new Uint8Array(await f.blob.arrayBuffer())
  }
  // Images and PDFs are already compressed; storing them is faster and just as small.
  const zipped = zipSync(entries, { level: 0 })
  return { name, blob: new Blob([zipped as Uint8Array<ArrayBuffer>], { type: 'application/zip' }) }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`
}
