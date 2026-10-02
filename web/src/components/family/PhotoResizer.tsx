import { useEffect, useRef, useState } from 'react'
import { Download, ImageDown, ImagePlus, Share2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Loader'
import { cn } from '@/lib/cn'

type Fit = 'crop' | 'contain'

interface Preset {
  id: string
  label: string
  hint: string
  /** Exact output size in px; omit both to keep the photo's shape. */
  width?: number
  height?: number
  /** Longest side when the shape is kept. */
  maxSide?: number
  maxKB: number
  minKB?: number
  fit: Fit
}

// Common limits on Indian exam, ID and visa portals — always double-check the portal's exact rule.
const PRESETS: Preset[] = [
  { id: 'exam-photo', label: 'Exam photo', hint: '200×230 px · 20–50 KB', width: 200, height: 230, maxKB: 50, minKB: 20, fit: 'crop' },
  { id: 'signature', label: 'Signature', hint: '140×60 px · 10–20 KB', width: 140, height: 60, maxKB: 20, minKB: 10, fit: 'contain' },
  { id: 'passport-size', label: 'Passport-size photo', hint: '35×45 mm (413×531 px) · ≤ 100 KB', width: 413, height: 531, maxKB: 100, fit: 'crop' },
  { id: 'visa', label: 'Square photo', hint: '600×600 px · ≤ 240 KB (US visa style)', width: 600, height: 600, maxKB: 240, fit: 'crop' },
  { id: 'doc-500', label: 'Document ≤ 500 KB', hint: 'Keeps the page shape, readable', maxSide: 1800, maxKB: 500, fit: 'contain' },
  { id: 'doc-200', label: 'Document ≤ 200 KB', hint: 'Keeps the page shape', maxSide: 1400, maxKB: 200, fit: 'contain' },
  { id: 'doc-100', label: 'Document ≤ 100 KB', hint: 'Keeps the page shape', maxSide: 1100, maxKB: 100, fit: 'contain' },
]

interface Result {
  blob: Blob
  url: string
  width: number
  height: number
  kb: number
  quality: number
  note?: string
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("This file couldn't be opened as an image. Try a JPG or PNG (or take a screenshot of it)."))
    img.src = url
  })
}

const toBlob = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode the image.'))), 'image/jpeg', quality))

function draw(img: HTMLImageElement, width: number, height: number, fit: Fit): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff' // portals expect a white background, never transparent
  ctx.fillRect(0, 0, width, height)
  ctx.imageSmoothingQuality = 'high'
  const scale = fit === 'crop' ? Math.max(width / img.naturalWidth, height / img.naturalHeight) : Math.min(width / img.naturalWidth, height / img.naturalHeight)
  const w = img.naturalWidth * scale
  const h = img.naturalHeight * scale
  ctx.drawImage(img, (width - w) / 2, (height - h) / 2, w, h)
  return canvas
}

/**
 * Small portal photos (e.g. 200×230 px) can't reach a "minimum 20 KB" rule even at top quality.
 * Portals only check the file size, so we add JPEG comment segments (FF FE) right after the
 * start marker: a valid file, pixel-for-pixel the same image, just heavier.
 */
async function padJpeg(blob: Blob, targetBytes: number): Promise<Blob> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes.length >= targetBytes) return blob
  const segments: Uint8Array<ArrayBuffer>[] = []
  let missing = targetBytes - bytes.length
  while (missing > 0) {
    const payload = Math.min(65533, Math.max(1, missing - 4))
    const seg = new Uint8Array(payload + 4)
    seg[0] = 0xff
    seg[1] = 0xfe
    seg[2] = ((payload + 2) >> 8) & 0xff
    seg[3] = (payload + 2) & 0xff
    seg.fill(0x20, 4)
    segments.push(seg)
    missing -= seg.length
  }
  return new Blob([bytes.slice(0, 2), ...segments, bytes.slice(2)], { type: 'image/jpeg' })
}

/** Highest JPEG quality that fits under maxKB (binary search); shrinks the size if it must and may. */
async function fitToSize(img: HTMLImageElement, target: { width?: number; height?: number; maxSide?: number; maxKB: number; minKB?: number; fit: Fit }): Promise<Result> {
  const fixed = !!(target.width && target.height)
  let width = target.width ?? 0
  let height = target.height ?? 0
  if (!fixed) {
    const side = target.maxSide ?? 1600
    const scale = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight))
    width = Math.round(img.naturalWidth * scale)
    height = Math.round(img.naturalHeight * scale)
  }
  const limit = target.maxKB * 1024
  for (let attempt = 0; attempt < 8; attempt++) {
    const canvas = draw(img, width, height, target.fit)
    let lo = 0.3
    let hi = 0.95
    let best: Blob | null = null
    let bestQ = 0
    const top = await toBlob(canvas, hi)
    if (top.size <= limit) {
      best = top
      bestQ = hi
    } else {
      for (let i = 0; i < 7; i++) {
        const q = (lo + hi) / 2
        const b = await toBlob(canvas, q)
        if (b.size <= limit) {
          best = b
          bestQ = q
          lo = q
        } else hi = q
      }
    }
    if (best) {
      let note: string | undefined
      if (target.minKB && best.size < target.minKB * 1024) {
        // Below the portal's minimum: first the best possible quality, then (only if still short) padding.
        const fullQuality = await toBlob(canvas, 1)
        if (fullQuality.size <= limit) {
          best = fullQuality
          bestQ = 1
        }
        if (best.size < target.minKB * 1024) {
          const goal = Math.min(limit - 512, Math.round((target.minKB + Math.min(5, (target.maxKB - target.minKB) / 2)) * 1024))
          best = await padJpeg(best, goal)
          note = `Padded to ${Math.round(best.size / 1024)} KB to meet the ${target.minKB} KB minimum — the picture itself is unchanged.`
        }
      }
      return { blob: best, url: URL.createObjectURL(best), width, height, kb: best.size / 1024, quality: bestQ, note }
    }
    if (fixed) {
      const smallest = await toBlob(canvas, 0.3)
      return { blob: smallest, url: URL.createObjectURL(smallest), width, height, kb: smallest.size / 1024, quality: 0.3, note: `Couldn't get under ${target.maxKB} KB at ${width}×${height} — this is the smallest (${Math.round(smallest.size / 1024)} KB). Try a plainer background.` }
    }
    width = Math.round(width * 0.85)
    height = Math.round(height * 0.85)
  }
  throw new Error("Couldn't make it small enough.")
}

export function PhotoResizer() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [presetId, setPresetId] = useState(PRESETS[0].id)
  const [custom, setCustom] = useState({ width: '', height: '', maxKB: '50' })
  const [fit, setFit] = useState<Fit>(PRESETS[0].fit)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)

  const preset = PRESETS.find((p) => p.id === presetId)
  const target = preset
    ? { ...preset, fit }
    : { width: Number(custom.width) || undefined, height: Number(custom.height) || undefined, maxSide: 1600, maxKB: Number(custom.maxKB) || 100, fit }

  // Re-process whenever the photo or the target changes.
  useEffect(() => {
    if (!img) return
    let cancelled = false
    setBusy(true)
    setError(null)
    fitToSize(img, target)
      .then((r) => {
        if (cancelled) return URL.revokeObjectURL(r.url)
        setResult((old) => {
          if (old) URL.revokeObjectURL(old.url)
          return r
        })
      })
      .catch((err: unknown) => !cancelled && setError(err instanceof Error ? err.message : "Couldn't resize."))
      .finally(() => !cancelled && setBusy(false))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img, presetId, fit, custom.width, custom.height, custom.maxKB])

  const pick = async (f: File | undefined) => {
    if (!f) return
    setError(null)
    try {
      setFile(f)
      setImg(await loadImage(f))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't open the image.")
    }
  }

  const outName = () => `${(file?.name ?? 'photo').replace(/\.[^.]+$/, '')}-${result ? `${result.width}x${result.height}-${Math.round(result.kb)}kb` : 'resized'}.jpg`

  const download = () => {
    if (!result) return
    const a = document.createElement('a')
    a.href = result.url
    a.download = outName()
    a.click()
  }

  const share = async () => {
    if (!result) return
    const shared = new File([result.blob], outName(), { type: 'image/jpeg' })
    try {
      await navigator.share({ files: [shared] })
    } catch {
      // cancelled
    }
  }
  const canShare = typeof navigator !== 'undefined' && !!navigator.canShare && !!result && navigator.canShare({ files: [new File([result.blob], 'x.jpg', { type: 'image/jpeg' })] })

  return (
    <div className="space-y-4">
      <p className="flex items-start gap-1.5 text-xs text-ink-soft">
        <ShieldCheck size={14} className="mt-0.5 shrink-0 text-success" />
        Resize a photo, signature or scan to a portal's exact size limit. It all happens on this device — nothing is uploaded.
      </p>

      <div>
        <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-muted">1 · What is it for?</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[...PRESETS, { id: 'custom', label: 'Custom', hint: 'Your own size and KB limit' } as const].map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setPresetId(p.id)
                const found = PRESETS.find((x) => x.id === p.id)
                if (found) setFit(found.fit)
              }}
              aria-pressed={presetId === p.id}
              className={cn(
                'rounded-card border px-3 py-2.5 text-left transition-colors',
                presetId === p.id ? 'border-rust bg-rust/[0.06]' : 'border-border-soft bg-card hover:bg-bg-soft',
              )}
            >
              <span className="block text-xs font-medium text-ink">{p.label}</span>
              <span className="block text-[10.5px] leading-snug text-ink-muted">{p.hint}</span>
            </button>
          ))}
        </div>
        {presetId === 'custom' && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            <label className="text-[11px] text-ink-soft">
              Width px
              <Input value={custom.width} onChange={(e) => setCustom({ ...custom, width: e.target.value.replace(/\D/g, '') })} inputMode="numeric" placeholder="Auto" />
            </label>
            <label className="text-[11px] text-ink-soft">
              Height px
              <Input value={custom.height} onChange={(e) => setCustom({ ...custom, height: e.target.value.replace(/\D/g, '') })} inputMode="numeric" placeholder="Auto" />
            </label>
            <label className="text-[11px] text-ink-soft">
              Max KB
              <Input value={custom.maxKB} onChange={(e) => setCustom({ ...custom, maxKB: e.target.value.replace(/\D/g, '') })} inputMode="numeric" />
            </label>
          </div>
        )}
        {(preset?.width || (presetId === 'custom' && custom.width && custom.height)) && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(['crop', 'contain'] as Fit[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFit(f)}
                className={cn('rounded-full border px-3 py-1.5 text-[11.5px]', fit === f ? 'border-ink bg-ink text-paper' : 'border-border text-ink-soft')}
              >
                {f === 'crop' ? 'Fill the frame (crop edges)' : 'Fit whole image (white border)'}
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-muted">2 · Choose the photo</p>
        <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => void pick(e.target.files?.[0])} />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-card border border-dashed border-border bg-bg-soft/50 px-4 py-6 text-xs text-ink-soft transition-colors hover:border-rust/50 hover:text-ink"
        >
          <ImagePlus size={18} />
          {file ? `${file.name} · ${Math.round(file.size / 1024)} KB — tap to change` : 'Take a photo or pick one from your gallery'}
        </button>
      </div>

      {error && <p className="rounded-sm bg-danger-soft px-3 py-2 text-[11.5px] text-danger">{error}</p>}

      {img && (
        <Card className="space-y-3">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-muted">3 · Result</p>
          {busy || !result ? (
            <div className="flex items-center gap-2 py-6 text-xs text-ink-soft">
              <Spinner /> Finding the best quality under the limit…
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
                <div className="flex max-h-72 items-center justify-center overflow-hidden rounded-sm border border-border-soft bg-[repeating-conic-gradient(#f1ece2_0%_25%,#fff_0%_50%)] bg-[length:16px_16px] p-2">
                  <img src={result.url} alt="Resized preview" className="max-h-64 max-w-full object-contain" />
                </div>
                <dl className="grid w-full grid-cols-2 gap-2 text-xs sm:w-auto sm:grid-cols-1">
                  <div className="rounded-sm bg-bg-soft px-3 py-2">
                    <dt className="text-[10px] uppercase tracking-[0.08em] text-ink-muted">Size</dt>
                    <dd className="font-mono-figure font-semibold text-ink">
                      {Math.round(result.kb)} KB <span className="font-normal text-ink-muted">(was {Math.round((file?.size ?? 0) / 1024)} KB)</span>
                    </dd>
                  </div>
                  <div className="rounded-sm bg-bg-soft px-3 py-2">
                    <dt className="text-[10px] uppercase tracking-[0.08em] text-ink-muted">Dimensions</dt>
                    <dd className="font-mono-figure font-semibold text-ink">
                      {result.width} × {result.height} px
                    </dd>
                  </div>
                </dl>
              </div>
              {result.note && <p className={cn("rounded-sm px-3 py-2 text-[11.5px] text-ink", result.note.startsWith("Padded") ? "bg-success-soft" : "bg-warning-soft")}>{result.note}</p>}
              <div className="flex flex-wrap gap-2">
                {canShare && (
                  <Button size="sm" icon={<Share2 size={13} />} onClick={() => void share()}>
                    Save or share
                  </Button>
                )}
                <Button size="sm" variant={canShare ? 'secondary' : 'primary'} icon={<Download size={13} />} onClick={download}>
                  Download JPG
                </Button>
              </div>
              <p className="flex items-center gap-1.5 text-[10.5px] text-ink-muted">
                <ImageDown size={11} /> On iPhone, “Save or share” → “Save Image” puts it in Photos, ready to upload.
              </p>
            </>
          )}
        </Card>
      )}
    </div>
  )
}
