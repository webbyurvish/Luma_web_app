import type { PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs'

/**
 * One place that opens PDFs with pdf.js (statement import, File tools).
 * The legacy build carries fallbacks for very new JS (Map.getOrInsertComputed, Math.sumPrecise)
 * that iPhone Safari doesn't have yet — the modern build fails there with "undefined is not a function".
 * Loaded on first use only.
 */
export class PdfPasswordError extends Error {
  wrong: boolean
  constructor(wrong: boolean) {
    super(wrong ? 'That password is not right.' : 'This PDF is password-protected.')
    this.name = 'PdfPasswordError'
    this.wrong = wrong
  }
}

async function lib() {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const worker = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  return pdfjs
}

/** Opens a PDF; call `close()` when done (frees the worker's copy). */
export async function openPdf(data: ArrayBuffer | Uint8Array, password?: string): Promise<{ doc: PDFDocumentProxy; close: () => Promise<void> }> {
  const pdfjs = await lib()
  // pdf.js takes ownership of the buffer it is given, so it always gets a copy.
  const task = pdfjs.getDocument({ data: new Uint8Array(data instanceof Uint8Array ? data : new Uint8Array(data)).slice(), password })
  try {
    const doc = await task.promise
    return { doc, close: () => task.destroy() }
  } catch (err) {
    await task.destroy().catch(() => {})
    const e = err as { name?: string; code?: number }
    if (e?.name === 'PasswordException') throw new PdfPasswordError(e.code === 2)
    throw new Error("This doesn't look like a readable PDF.")
  }
}

/** Renders one page to a canvas at `scale` (1 = 72 dpi). White background, so JPEG never goes black. */
export async function renderPage(doc: PDFDocumentProxy, pageNumber: number, scale: number): Promise<HTMLCanvasElement> {
  const page = await doc.getPage(pageNumber)
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.floor(viewport.width))
  canvas.height = Math.max(1, Math.floor(viewport.height))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error("Couldn't draw the page on this device.")
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  // 'print' renders the page as it prints (right for conversions) and, unlike 'display', doesn't
  // pace itself on animation frames — which stop when the app is in the background mid-job.
  await page.render({ canvas, canvasContext: ctx, viewport, intent: 'print' }).promise
  page.cleanup()
  return canvas
}
