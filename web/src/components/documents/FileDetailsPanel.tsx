import { useEffect, useState } from 'react'
import { Download, ExternalLink, FolderInput, Trash2 } from 'lucide-react'
import { SlideOver } from '@/components/ui/SlideOver'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ExpiryBadge } from './DocumentItems'
import { driveLinks, formatBytes } from './driveLinks'
import { formatDate } from '@/lib/formatDate'
import type { DriveFile, DriveFileDetails } from '@/types'

interface FileDetailsPanelProps {
  file: DriveFile | null
  /** "Folder / Subfolder" the file lives in. */
  path: string
  today: string
  /** Open straight on the edit form rather than the preview. */
  startEditing?: boolean
  saving?: boolean
  onClose: () => void
  onSave: (details: Partial<DriveFileDetails>) => void
  onMove: (file: DriveFile) => void
  onDelete: (file: DriveFile) => void
}

/** Splits "Policy 2026.pdf" into ["Policy 2026", ".pdf"] so renames keep the extension. */
function splitExtension(name: string): [string, string] {
  const dot = name.lastIndexOf('.')
  return dot > 0 && name.length - dot <= 6 ? [name.slice(0, dot), name.slice(dot)] : [name, '']
}

export function FileDetailsPanel({ file: incomingFile, path, today, startEditing, saving, onClose, onSave, onMove, onDelete }: FileDetailsPanelProps) {
  // Keep showing the last file while the panel slides out after closing.
  const [file, setFile] = useState<DriveFile | null>(incomingFile)
  useEffect(() => {
    if (incomingFile) setFile(incomingFile)
  }, [incomingFile])
  const [baseName, setBaseName] = useState('')
  const [extension, setExtension] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [showPreview, setShowPreview] = useState(true)

  useEffect(() => {
    if (!file) return
    const [base, ext] = splitExtension(file.name)
    setBaseName(base)
    setExtension(ext)
    setDescription(file.description)
    setTags(file.tags)
    setExpiryDate(file.expiryDate)
    setShowPreview(!startEditing)
  }, [file, startEditing])

  if (!file) return null

  const name = `${baseName.trim()}${extension}`
  const changed: Partial<DriveFileDetails> = {}
  if (baseName.trim() && name !== file.name) changed.name = name
  if (description !== file.description) changed.description = description
  if (tags !== file.tags) changed.tags = tags
  if (expiryDate !== file.expiryDate) changed.expiryDate = expiryDate
  const dirty = Object.keys(changed).length > 0

  const preview = driveLinks.preview(file.id)
  const view = driveLinks.view(file.id)
  const download = driveLinks.download(file.id)

  return (
    <SlideOver
      open={incomingFile !== null}
      onClose={onClose}
      busy={saving}
      title={file.name}
      subtitle={`${path || 'Luma Documents'} · ${file.kind} · ${formatBytes(file.size)}`}
      className="sm:w-[520px] md:w-[560px]"
      footer={
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" icon={<Trash2 size={13} />} onClick={() => onDelete(file)} className="mr-auto hover:!bg-danger-soft hover:!text-danger">
            Trash
          </Button>
          <Button type="button" variant="secondary" size="sm" icon={<FolderInput size={13} />} onClick={() => onMove(file)}>
            Move
          </Button>
          <Button type="button" size="sm" disabled={!dirty} loading={saving} loadingText="Saving…" onClick={() => onSave(changed)}>
            Save details
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap gap-2">
          {view && (
            <a href={view} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-pill border border-border px-3 py-1.5 text-[11px] text-ink transition-colors hover:bg-bg-soft">
              <ExternalLink size={12} /> Open in Drive
            </a>
          )}
          {download && (
            <a href={download} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-pill border border-border px-3 py-1.5 text-[11px] text-ink transition-colors hover:bg-bg-soft">
              <Download size={12} /> Download
            </a>
          )}
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-pill border border-border px-3 py-1.5 text-[11px] text-ink transition-colors hover:bg-bg-soft"
          >
            {showPreview ? 'Hide preview' : 'Show preview'}
          </button>
        </div>

        {showPreview && preview && (
          <div className="overflow-hidden rounded-card border border-border-soft bg-bg-soft">
            <iframe src={preview} title={`Preview of ${file.name}`} className="h-[360px] w-full" allow="autoplay" />
            <p className="border-t border-border-soft px-3 py-1.5 text-[10px] text-ink-muted">Preview needs this browser signed in to the Google account that owns the file.</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 text-[11px]">
          <div>
            <p className="text-[10px] uppercase tracking-[0.06em] text-ink-muted">Added</p>
            <p className="mt-0.5 text-ink">{formatDate(file.createdAt)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.06em] text-ink-muted">Last changed</p>
            <p className="mt-0.5 text-ink">{formatDate(file.updatedAt)}</p>
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-border-soft pt-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-soft">Name</label>
            <div className="flex items-center gap-1.5">
              <Input value={baseName} onChange={(e) => setBaseName(e.target.value)} />
              {extension && <span className="shrink-0 font-mono-figure text-xs text-ink-muted">{extension}</span>}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-soft">Description</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this document?" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-soft">Tags</label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Comma separated, e.g. car, 2026, hdfc" />
          </div>
          <div>
            <label className="mb-1.5 flex items-center justify-between text-xs font-medium text-ink-soft">
              Expiry / renewal date
              <ExpiryBadge expiryDate={expiryDate} today={today} />
            </label>
            <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
            <p className="mt-1 text-[10.5px] text-ink-muted">Policies, passports, PUC… Luma flags it 30 days before it runs out.</p>
          </div>
        </div>
      </div>
    </SlideOver>
  )
}
