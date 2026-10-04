import { useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Download, FilePlus2, FolderDown, Loader2, Share2, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/context/ToastContext'
import { canShareFiles, downloadFile, saveToDocuments, shareFiles } from '@/lib/fileOut'
import { formatBytes, zipFiles, type OutFile } from '@/lib/fileTools'
import { getErrorMessage } from '@/lib/errors'
import { cn } from '@/lib/cn'

/** Pick one or many files; many can be reordered (merge / photos → PDF order matters). */
export function FilePicker({
  files,
  onChange,
  accept,
  multiple,
  label,
  hint,
}: {
  files: File[]
  onChange: (files: File[]) => void
  accept: string
  multiple?: boolean
  label: string
  hint?: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const move = (i: number, by: number) => {
    const next = [...files]
    const [f] = next.splice(i, 1)
    next.splice(i + by, 0, f)
    onChange(next)
  }
  return (
    <div className="space-y-2">
      {files.length > 0 && (
        <ul className="divide-y divide-border-soft rounded-md border border-border">
          {files.map((f, i) => (
            <li key={`${f.name}-${f.size}-${i}`} className="flex items-center gap-2 px-3 py-2">
              {multiple && <span className="w-5 shrink-0 text-center font-mono-figure text-[11px] text-ink-muted">{i + 1}</span>}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-medium text-ink">{f.name}</p>
                <p className="text-[10.5px] text-ink-muted">{formatBytes(f.size)}</p>
              </div>
              {multiple && files.length > 1 && (
                <>
                  <button type="button" aria-label={`Move ${f.name} up`} disabled={i === 0} onClick={() => move(i, -1)} className="rounded-sm p-1.5 text-ink-soft hover:bg-bg-soft disabled:opacity-30">
                    <ArrowUp size={14} />
                  </button>
                  <button type="button" aria-label={`Move ${f.name} down`} disabled={i === files.length - 1} onClick={() => move(i, 1)} className="rounded-sm p-1.5 text-ink-soft hover:bg-bg-soft disabled:opacity-30">
                    <ArrowDown size={14} />
                  </button>
                </>
              )}
              <button type="button" aria-label={`Remove ${f.name}`} onClick={() => onChange(files.filter((_, j) => j !== i))} className="rounded-sm p-1.5 text-ink-muted hover:bg-bg-soft hover:text-danger">
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {(multiple || files.length === 0) && (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border bg-bg-soft/50 px-3 py-5 text-sm font-medium text-ink transition-colors hover:border-rust/60 hover:bg-bg-soft"
        >
          <FilePlus2 size={17} className="text-rust" />
          {files.length ? 'Add more' : label}
        </button>
      )}
      {hint && files.length === 0 && <p className="text-[11px] text-ink-muted">{hint}</p>}
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? [])
          e.target.value = ''
          if (picked.length) onChange(multiple ? [...files, ...picked] : picked.slice(0, 1))
        }}
      />
    </div>
  )
}

export function Progress({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-2 rounded-md bg-bg-soft px-3 py-2.5 text-xs text-ink-soft" role="status">
      <Loader2 size={14} className="animate-spin-smooth text-rust" /> {label}
    </p>
  )
}

/** The finished files: share sheet, download, or save into Documents. Several files can go as one ZIP. */
export function Results({ files, note }: { files: OutFile[]; note?: string }) {
  const { showToast } = useToast()
  const [busy, setBusy] = useState('')
  const share = canShareFiles(files)
  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key)
    try {
      await fn()
    } catch (err) {
      showToast(getErrorMessage(err, 'That didn’t work. Please try again.'), 'error')
    } finally {
      setBusy('')
    }
  }
  return (
    <div className="space-y-3 rounded-md border border-success/30 bg-success-soft/40 p-3">
      <p className="text-xs font-semibold text-ink">
        Ready · {files.length} file{files.length === 1 ? '' : 's'}
      </p>
      {note && <p className="text-[11px] text-ink-soft">{note}</p>}
      <ul className="divide-y divide-border-soft rounded-md border border-border bg-card">
        {files.map((f) => (
          <li key={f.name} className="flex items-center gap-2 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-medium text-ink">{f.name}</p>
              <p className="text-[10.5px] text-ink-muted">{formatBytes(f.blob.size)}</p>
            </div>
            {share && (
              <button type="button" aria-label={`Share ${f.name}`} onClick={() => void run(`s-${f.name}`, async () => void (await shareFiles([f])))} className="rounded-sm p-1.5 text-ink-soft hover:bg-bg-soft">
                <Share2 size={15} />
              </button>
            )}
            <button type="button" aria-label={`Download ${f.name}`} onClick={() => downloadFile(f)} className="rounded-sm p-1.5 text-ink-soft hover:bg-bg-soft">
              <Download size={15} />
            </button>
            <button
              type="button"
              aria-label={`Save ${f.name} to Documents`}
              disabled={!!busy}
              onClick={() => void run(`d-${f.name}`, async () => showToast(`Saved in ${await saveToDocuments(f)}`))}
              className={cn('rounded-sm p-1.5 text-ink-soft hover:bg-bg-soft disabled:opacity-40', busy === `d-${f.name}` && 'animate-pulse')}
            >
              <FolderDown size={15} />
            </button>
          </li>
        ))}
      </ul>
      {files.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {share && (
            <Button size="sm" icon={<Share2 size={13} />} loading={busy === 'all'} onClick={() => void run('all', async () => void (await shareFiles(files)))}>
              Share all
            </Button>
          )}
          <Button
            size="sm"
            variant="secondary"
            icon={<Download size={13} />}
            loading={busy === 'zip'}
            loadingText="Zipping…"
            onClick={() => void run('zip', async () => downloadFile(await zipFiles(files, `${files[0].name.replace(/( - page \d+| \(pages? [\d-]+\))?\.[^.]+$/, '')}.zip`)))}
          >
            Download as ZIP
          </Button>
        </div>
      )}
      <p className="text-[10.5px] text-ink-muted">
        {share ? 'Share opens the phone’s share sheet: Save to Files, WhatsApp, Mail. ' : ''}The folder icon saves a copy in Documents.
      </p>
    </div>
  )
}
