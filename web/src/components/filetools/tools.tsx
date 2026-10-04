import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, RotateCw, Trash2, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Chips, Field } from '@/components/life/FormBits'
import { FilePicker, Progress, Results } from './ToolKit'
import {
  baseName,
  buildFromPlan,
  compressPdf,
  convertImage,
  formatBytes,
  imagesToPdf,
  isImage,
  isPdf,
  mergePdfs,
  pageCount,
  parseRanges,
  pdfThumbnails,
  pdfToImages,
  splitPdf,
  type ImageFormat,
  type OutFile,
  type PagePlan,
  type PageSize,
} from '@/lib/fileTools'
import { convertOfficeFile } from '@/services/googleSheetsApi'
import { getErrorMessage } from '@/lib/errors'
import { cn } from '@/lib/cn'

/** Shared run/progress/result/error state for a tool. */
function useJob() {
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [out, setOut] = useState<{ files: OutFile[]; note?: string } | null>(null)
  const run = async (label: string, fn: (step: (s: string) => void) => Promise<{ files: OutFile[]; note?: string }>) => {
    setError('')
    setOut(null)
    setBusy(label)
    try {
      setOut(await fn(setBusy))
    } catch (err) {
      setError(getErrorMessage(err, 'That didn’t work. Please try again.'))
    } finally {
      setBusy('')
    }
  }
  const reset = () => {
    setOut(null)
    setError('')
  }
  const fail = (err: unknown) => setError(getErrorMessage(err, 'That file could not be opened.'))
  return { busy, error, out, run, reset, fail }
}

function Footer({ job, label, disabled, onRun }: { job: ReturnType<typeof useJob>; label: string; disabled?: boolean; onRun: () => void }) {
  return (
    <div className="space-y-3">
      {job.error && <p className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{job.error}</p>}
      {job.busy ? <Progress label={job.busy} /> : <Button className="w-full" disabled={disabled} onClick={onRun}>{label}</Button>}
      {job.out && <Results files={job.out.files} note={job.out.note} />}
    </div>
  )
}

const pdfAccept = 'application/pdf,.pdf'
const imageAccept = 'image/*,.heic,.heif'

/* ------------------------------------------------------------ Photos → PDF */

export function ImagesToPdfTool() {
  const job = useJob()
  const [files, setFiles] = useState<File[]>([])
  const [size, setSize] = useState<PageSize>('a4')
  const [margin, setMargin] = useState<'none' | 'small' | 'normal'>('small')
  const [quality, setQuality] = useState<'standard' | 'high'>('standard')
  const [name, setName] = useState('')
  const bad = files.filter((f) => !isImage(f))
  return (
    <div className="space-y-4">
      <FilePicker files={files} onChange={(f) => (setFiles(f), job.reset())} accept={imageAccept} multiple label="Choose photos" hint="Aadhaar front and back, marksheets, receipts — one page per photo, in this order." />
      <Field label="Page size">
        <Chips value={size} options={['a4', 'letter', 'fit'] as PageSize[]} labels={{ a4: 'A4', letter: 'Letter', fit: 'Same as photo' }} onChange={setSize} />
      </Field>
      {size !== 'fit' && (
        <Field label="Margin">
          <Chips value={margin} options={['none', 'small', 'normal'] as const} labels={{ none: 'None', small: 'Small', normal: 'Normal' }} onChange={setMargin} />
        </Field>
      )}
      <Field label="Quality">
        <Chips value={quality} options={['standard', 'high'] as const} labels={{ standard: 'Standard (smaller file)', high: 'High' }} onChange={setQuality} />
      </Field>
      <Field label="File name">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={files[0] ? baseName(files[0].name) : 'Scans'} />
      </Field>
      {bad.length > 0 && <p className="text-[11px] text-warning">{bad.map((f) => f.name).join(', ')} isn't a photo and will be skipped.</p>}
      <Footer
        job={job}
        label={`Make PDF${files.length > 1 ? ` (${files.length} pages)` : ''}`}
        disabled={!files.some(isImage)}
        onRun={() =>
          void job.run('Building the PDF…', async (step) => {
            const photos = files.filter(isImage)
            const blob = await imagesToPdf(photos, { pageSize: size, margin: { none: 0, small: 18, normal: 36 }[margin], quality: quality === 'high' ? 0.9 : 0.72 }, (i) => step(`Adding photo ${i + 1} of ${photos.length}…`))
            return { files: [{ name: `${(name.trim() || baseName(photos[0].name)).replace(/\.pdf$/i, '')}.pdf`, blob }] }
          })
        }
      />
    </div>
  )
}

/* -------------------------------------------------------------- Merge PDFs */

export function MergeTool() {
  const job = useJob()
  const [files, setFiles] = useState<File[]>([])
  const [name, setName] = useState('')
  const pdfs = files.filter(isPdf)
  return (
    <div className="space-y-4">
      <FilePicker files={files} onChange={(f) => (setFiles(f), job.reset())} accept={pdfAccept} multiple label="Choose PDFs" hint="They're joined in this order; use the arrows to change it." />
      <Field label="File name">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Merged" />
      </Field>
      <Footer
        job={job}
        label={pdfs.length < 2 ? 'Choose at least 2 PDFs' : `Merge ${pdfs.length} PDFs`}
        disabled={pdfs.length < 2}
        onRun={() =>
          void job.run('Merging…', async (step) => {
            const blob = await mergePdfs(pdfs, (i) => step(`Adding ${pdfs[i].name}…`))
            return { files: [{ name: `${(name.trim() || 'Merged').replace(/\.pdf$/i, '')}.pdf`, blob }] }
          })
        }
      />
    </div>
  )
}

/* ---------------------------------------------------------------- Split PDF */

export function SplitTool() {
  const job = useJob()
  const [files, setFiles] = useState<File[]>([])
  const [total, setTotal] = useState(0)
  const [mode, setMode] = useState<'every' | 'ranges'>('ranges')
  const [ranges, setRanges] = useState('')
  const file = files[0]
  useEffect(() => {
    setTotal(0)
    if (!file) return
    let live = true
    pageCount(file).then(
      (n) => {
        if (live) setTotal(n)
      },
      (err) => {
        if (live) job.fail(err)
      },
    )
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file])
  return (
    <div className="space-y-4">
      <FilePicker files={files} onChange={(f) => (setFiles(f), job.reset())} accept={pdfAccept} label="Choose a PDF" />
      {total > 0 && <p className="text-xs text-ink-soft">{total} page{total === 1 ? '' : 's'}</p>}
      <Field label="How">
        <Chips value={mode} options={['ranges', 'every'] as const} labels={{ ranges: 'Pick pages', every: 'Every page separately' }} onChange={setMode} />
      </Field>
      {mode === 'ranges' && (
        <Field label="Pages" hint="One file per group, e.g. 1-3, 5, 8-10. A single group (e.g. 2-4) just extracts those pages.">
          <Input value={ranges} onChange={(e) => setRanges(e.target.value)} placeholder="1-3, 5, 8-10" inputMode="text" />
        </Field>
      )}
      <Footer
        job={job}
        label="Split"
        disabled={!file || !total || (mode === 'ranges' && !ranges.trim())}
        onRun={() =>
          void job.run('Splitting…', async () => {
            const groups = mode === 'every' ? Array.from({ length: total }, (_, i) => [i + 1]) : parseRanges(ranges, total)
            return { files: await splitPdf(file, groups) }
          })
        }
      />
    </div>
  )
}

/* --------------------------------------------------- Organise (order/rotate/delete) */

export function OrganiseTool() {
  const job = useJob()
  const [files, setFiles] = useState<File[]>([])
  const [thumbs, setThumbs] = useState<string[]>([])
  const [plan, setPlan] = useState<PagePlan[]>([])
  const [removed, setRemoved] = useState<PagePlan[]>([])
  const [loading, setLoading] = useState('')
  const file = files[0]
  useEffect(() => {
    setThumbs([])
    setPlan([])
    setRemoved([])
    if (!file) return
    let live = true
    setLoading('Opening…')
    pdfThumbnails(file, (n, t) => live && setLoading(`Reading page ${n} of ${t}…`))
      .then((t) => {
        if (!live) return
        setThumbs(t)
        setPlan(t.map((_, index) => ({ index, rotate: 0 })))
      })
      .catch((err) => {
        if (live) job.fail(err)
      })
      .finally(() => live && setLoading(''))
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file])
  const update = (next: PagePlan[]) => {
    setPlan(next)
    job.reset()
  }
  const move = (i: number, by: number) => {
    const next = [...plan]
    const [p] = next.splice(i, 1)
    next.splice(i + by, 0, p)
    update(next)
  }
  const changed = plan.length !== thumbs.length || plan.some((p, i) => p.index !== i || p.rotate)
  return (
    <div className="space-y-4">
      <FilePicker files={files} onChange={(f) => (setFiles(f), job.reset())} accept={pdfAccept} label="Choose a PDF" />
      {loading && <Progress label={loading} />}
      {plan.length > 0 && (
        <>
          <p className="text-[11px] text-ink-muted">Rotate, move or remove pages, then save a new PDF. The original isn't changed.</p>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {plan.map((p, i) => (
              <li key={`${p.index}-${i}`} className="rounded-md border border-border bg-card p-1.5">
                <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-sm bg-bg-soft">
                  <img src={thumbs[p.index]} alt={`Page ${p.index + 1}`} className="max-h-full max-w-full transition-transform" style={{ transform: `rotate(${p.rotate}deg)` }} />
                </div>
                <p className="mt-1 text-center font-mono-figure text-[10.5px] text-ink-muted">p. {p.index + 1}</p>
                <div className="mt-1 flex justify-between">
                  <button type="button" aria-label={`Move page ${p.index + 1} earlier`} disabled={i === 0} onClick={() => move(i, -1)} className="rounded-sm p-1 text-ink-soft hover:bg-bg-soft disabled:opacity-30">
                    <ArrowLeft size={13} />
                  </button>
                  <button type="button" aria-label={`Rotate page ${p.index + 1}`} onClick={() => update(plan.map((q, j) => (j === i ? { ...q, rotate: (q.rotate + 90) % 360 } : q)))} className="rounded-sm p-1 text-ink-soft hover:bg-bg-soft">
                    <RotateCw size={13} />
                  </button>
                  <button type="button" aria-label={`Remove page ${p.index + 1}`} disabled={plan.length === 1} onClick={() => (setRemoved([...removed, p]), update(plan.filter((_, j) => j !== i)))} className="rounded-sm p-1 text-ink-soft hover:bg-bg-soft hover:text-danger disabled:opacity-30">
                    <Trash2 size={13} />
                  </button>
                  <button type="button" aria-label={`Move page ${p.index + 1} later`} disabled={i === plan.length - 1} onClick={() => move(i, 1)} className="rounded-sm p-1 text-ink-soft hover:bg-bg-soft disabled:opacity-30">
                    <ArrowRight size={13} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {removed.length > 0 && (
            <button type="button" className="flex items-center gap-1 text-[11.5px] font-medium text-rust hover:underline" onClick={() => (update([...plan, removed[removed.length - 1]]), setRemoved(removed.slice(0, -1)))}>
              <Undo2 size={12} /> Bring back page {removed[removed.length - 1].index + 1}
            </button>
          )}
        </>
      )}
      <Footer
        job={job}
        label={changed ? `Save new PDF (${plan.length} page${plan.length === 1 ? '' : 's'})` : 'Make a change first'}
        disabled={!file || !changed}
        onRun={() => void job.run('Saving…', async () => ({ files: [{ name: `${baseName(file.name)} (edited).pdf`, blob: await buildFromPlan(file, plan) }] }))}
      />
    </div>
  )
}

/* ------------------------------------------------------------- Compress PDF */

const TARGETS = [100, 200, 300, 500, 1024, 2048]

export function CompressTool() {
  const job = useJob()
  const [files, setFiles] = useState<File[]>([])
  const [target, setTarget] = useState(200)
  const [custom, setCustom] = useState('')
  const file = files[0]
  const kb = custom.trim() ? Number(custom) : target
  const already = !!file && file.size <= kb * 1024
  return (
    <div className="space-y-4">
      <FilePicker files={files} onChange={(f) => (setFiles(f), job.reset())} accept={pdfAccept} label="Choose a PDF" hint="For portals that say “PDF under 200 KB”." />
      <Field label="Make it under">
        <Chips value={custom.trim() ? 'custom' : String(target)} options={[...TARGETS.map(String), 'custom']} labels={Object.fromEntries([...TARGETS.map((t) => [String(t), t >= 1024 ? `${t / 1024} MB` : `${t} KB`]), ['custom', 'Other']])} onChange={(v) => (v === 'custom' ? setCustom(custom || '150') : (setCustom(''), setTarget(Number(v))))} />
      </Field>
      {custom.trim() !== '' && (
        <Field label="Size limit (KB)">
          <Input value={custom} onChange={(e) => setCustom(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className="font-mono-figure" />
        </Field>
      )}
      {file && <p className="text-xs text-ink-soft">Now {formatBytes(file.size)}{already ? ' — already under that size.' : ''}</p>}
      <p className="text-[11px] text-ink-muted">Pages are redrawn as pictures to shrink them, so text in the result can't be selected or copied. Fine for scans and form uploads.</p>
      <Footer
        job={job}
        label="Compress"
        disabled={!file || !(kb > 10) || already}
        onRun={() =>
          void job.run('Compressing…', async (step) => {
            const { blob, reached } = await compressPdf(file, kb * 1024, step)
            // Typed (text) PDFs are usually already compact; drawn as pictures they only grow.
            if (blob.size >= file.size)
              throw new Error(`This PDF is already compact (${formatBytes(file.size)}) — redrawing it would only make it bigger. To get under ${formatBytes(kb * 1024)}, split it into parts with Split PDF.`)
            return {
              files: [{ name: `${baseName(file.name)} (compressed).pdf`, blob }],
              note: reached ? `${formatBytes(file.size)} → ${formatBytes(blob.size)}` : `Smallest possible is ${formatBytes(blob.size)} — still above ${formatBytes(kb * 1024)}. Try splitting it into parts.`,
            }
          })
        }
      />
    </div>
  )
}

/* ------------------------------------------------------------- PDF → photos */

export function PdfToImagesTool() {
  const job = useJob()
  const [files, setFiles] = useState<File[]>([])
  const [format, setFormat] = useState<'jpeg' | 'png'>('jpeg')
  const [dpi, setDpi] = useState(150)
  const file = files[0]
  return (
    <div className="space-y-4">
      <FilePicker files={files} onChange={(f) => (setFiles(f), job.reset())} accept={pdfAccept} label="Choose a PDF" />
      <Field label="Format">
        <Chips value={format} options={['jpeg', 'png'] as const} labels={{ jpeg: 'JPG (smaller)', png: 'PNG (sharper text)' }} onChange={setFormat} />
      </Field>
      <Field label="Resolution">
        <Chips value={String(dpi)} options={['100', '150', '300']} labels={{ '100': 'Small', '150': 'Standard', '300': 'Print (300 dpi)' }} onChange={(v) => setDpi(Number(v))} />
      </Field>
      <Footer
        job={job}
        label="Convert to photos"
        disabled={!file}
        onRun={() => void job.run('Converting…', async (step) => ({ files: await pdfToImages(file, { format, dpi }, (n, t) => step(`Page ${n} of ${t}…`)) }))}
      />
    </div>
  )
}

/* ----------------------------------------------------------- Photo format */

export function ImageFormatTool() {
  const job = useJob()
  const [files, setFiles] = useState<File[]>([])
  const [format, setFormat] = useState<ImageFormat>('jpeg')
  return (
    <div className="space-y-4">
      <FilePicker files={files} onChange={(f) => (setFiles(f), job.reset())} accept={imageAccept} multiple label="Choose photos" hint="iPhone HEIC photos, screenshots, WebP images from websites…" />
      <Field label="Change to">
        <Chips value={format} options={['jpeg', 'png', 'webp'] as ImageFormat[]} labels={{ jpeg: 'JPG', png: 'PNG', webp: 'WebP' }} onChange={setFormat} />
      </Field>
      <Footer
        job={job}
        label={`Convert${files.length > 1 ? ` ${files.length} photos` : ''}`}
        disabled={!files.length}
        onRun={() =>
          void job.run('Converting…', async (step) => {
            const out: OutFile[] = []
            const failed: string[] = []
            for (let i = 0; i < files.length; i++) {
              step(`Photo ${i + 1} of ${files.length}…`)
              const r = await convertImage(files[i], format, 0.9)
              if (r) out.push(r)
              else failed.push(files[i].name)
            }
            if (!out.length) throw new Error(`This browser can't save ${format.toUpperCase()} files. Choose JPG or PNG.`)
            return { files: out, note: failed.length ? `${failed.length} couldn't be converted here.` : undefined }
          })
        }
      />
    </div>
  )
}

/* ------------------------------------------- Word / Excel / PowerPoint via Drive */

const FAMILIES: Record<string, 'doc' | 'sheet' | 'slides'> = {
  docx: 'doc', doc: 'doc', odt: 'doc', rtf: 'doc', txt: 'doc', html: 'doc', htm: 'doc', pdf: 'doc', jpg: 'doc', jpeg: 'doc', png: 'doc',
  xlsx: 'sheet', xls: 'sheet', ods: 'sheet', csv: 'sheet',
  pptx: 'slides', ppt: 'slides', odp: 'slides',
}
const TARGETS_BY_FAMILY = {
  doc: ['pdf', 'docx', 'odt', 'rtf', 'txt', 'html', 'epub'],
  sheet: ['pdf', 'xlsx', 'csv', 'ods'],
  slides: ['pdf', 'pptx', 'odp', 'txt'],
} as const
const TARGET_LABEL: Record<string, string> = { pdf: 'PDF', docx: 'Word (.docx)', odt: 'OpenDocument', rtf: 'RTF', txt: 'Plain text', html: 'Web page (zip)', epub: 'eBook (EPUB)', xlsx: 'Excel (.xlsx)', csv: 'CSV', ods: 'OpenDocument', pptx: 'PowerPoint (.pptx)', odp: 'OpenDocument' }
const OCR_LANGS = [
  ['en', 'English'],
  ['hi', 'Hindi'],
  ['gu', 'Gujarati'],
  ['mr', 'Marathi'],
] as const

const extOf = (f: File) => (f.name.match(/\.([a-z0-9]+)$/i)?.[1] ?? '').toLowerCase()

function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '')
    r.onerror = () => reject(new Error("Couldn't read the file."))
    r.readAsDataURL(file)
  })
}

/** mode 'office' = Word/Excel/PowerPoint to anything; 'toWord' = PDF or a scan into an editable Word file. */
export function OfficeTool({ mode }: { mode: 'office' | 'toWord' }) {
  const job = useJob()
  const [files, setFiles] = useState<File[]>([])
  const [to, setTo] = useState<string>(mode === 'toWord' ? 'docx' : 'pdf')
  const [lang, setLang] = useState<string>('en')
  const file = files[0]
  const ext = file ? extOf(file) : ''
  const family = FAMILIES[ext]
  const reads = ext === 'pdf' || ext === 'jpg' || ext === 'jpeg' || ext === 'png'
  const options = family ? TARGETS_BY_FAMILY[family].filter((t) => t !== ext && !(mode === 'office' && reads && t === 'pdf')) : []
  useEffect(() => {
    if (family && !options.includes(to as never)) setTo(options[0] ?? 'pdf')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ext])
  const accept = mode === 'toWord' ? 'application/pdf,.pdf,image/jpeg,image/png' : '.doc,.docx,.odt,.rtf,.txt,.html,.xls,.xlsx,.ods,.csv,.ppt,.pptx,.odp'
  return (
    <div className="space-y-4">
      <FilePicker
        files={files}
        onChange={(f) => (setFiles(f), job.reset())}
        accept={accept}
        label={mode === 'toWord' ? 'Choose a PDF or a scan' : 'Choose a Word, Excel or PowerPoint file'}
        hint={mode === 'toWord' ? 'Works best on letters and typed documents. Complex tables and forms come out rough.' : 'Up to 10 MB.'}
      />
      {file && !family && <p className="text-xs text-danger">.{ext || '?'} files can't be converted here.</p>}
      {family && options.length > 0 && (
        <Field label="Turn it into">
          <Chips value={to} options={options as readonly string[]} labels={TARGET_LABEL} onChange={setTo} />
        </Field>
      )}
      {reads && (
        <Field label="Language of the text" hint="Helps Google read the words correctly.">
          <Chips value={lang} options={OCR_LANGS.map(([v]) => v)} labels={Object.fromEntries(OCR_LANGS)} onChange={setLang} />
        </Field>
      )}
      <p className="text-[11px] text-ink-muted">Converted by your own Google Drive: a temporary copy is made, converted and deleted straight away.</p>
      <Footer
        job={job}
        label={family ? `Convert to ${TARGET_LABEL[to] ?? to.toUpperCase()}` : 'Convert'}
        disabled={!file || !family || file.size > 10 * 1024 * 1024}
        onRun={() =>
          void job.run('Google is converting it… (up to a minute)', async () => {
            const res = await convertOfficeFile(file.name, await readBase64(file), to, reads ? lang : undefined)
            const bytes = Uint8Array.from(atob(res.dataBase64), (c) => c.charCodeAt(0))
            return { files: [{ name: res.fileName, blob: new Blob([bytes], { type: res.mimeType }) }], note: reads && to === 'docx' ? 'Check the result: text read from scans can have small mistakes.' : undefined }
          })
        }
      />
      {file && file.size > 10 * 1024 * 1024 && <p className={cn('text-xs text-danger')}>That file is over 10 MB. Compress or split it first.</p>}
    </div>
  )
}
