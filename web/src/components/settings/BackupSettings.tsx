import { useCallback, useEffect, useState } from 'react'
import { CloudUpload, DatabaseBackup, Download, ExternalLink, History } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Switch } from '@/components/ui/Switch'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/context/ToastContext'
import { backupApi, getBackupStatus, type BackupStatus } from '@/services/googleSheetsApi'
import { formatRelativeDate } from '@/lib/formatDate'
import { getErrorMessage } from '@/lib/errors'

/** Saves base64 data as a file — on iPhone this opens the share sheet ("Save to Files"). */
function saveFile(base64: string, fileName: string, mime: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

export function BackupSettings() {
  const { showToast } = useToast()
  const [status, setStatus] = useState<BackupStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'toggle' | 'now' | 'export' | null>(null)

  const load = useCallback(() => {
    setError(null)
    getBackupStatus()
      .then(setStatus)
      .catch((err: unknown) => setError(getErrorMessage(err, "Couldn't check your backups.")))
  }, [])

  useEffect(load, [load])

  const run = async (kind: 'toggle' | 'now' | 'export') => {
    setBusy(kind)
    try {
      if (kind === 'toggle') {
        const next = status?.enabled ? await backupApi.disable() : await backupApi.enable()
        setStatus(next.status)
        showToast(next.status.enabled ? 'Nightly backups are on' : 'Nightly backups switched off — existing copies are kept')
      } else if (kind === 'now') {
        const res = await backupApi.now()
        setStatus(res.status)
        showToast('Backup saved to your Drive')
      } else {
        const file = await backupApi.exportXlsx()
        saveFile(file.dataBase64, file.fileName, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        showToast(`${file.fileName} downloaded`)
      }
    } catch (err) {
      showToast(getErrorMessage(err, "That didn't work."), 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card hoverable className="max-w-2xl">
      <CardHeader title="Backups and export" subtitle="Copies of everything, in your own Google Drive" icon={<DatabaseBackup size={17} className="text-ink-soft" />} />

      {error ? (
        <div className="rounded-card border border-warning/30 bg-warning-soft/50 px-4 py-3 text-xs text-ink">
          <p>{error}</p>
          <Button variant="secondary" size="sm" className="mt-2" onClick={load}>
            Check again
          </Button>
        </div>
      ) : !status ? (
        <Skeleton className="h-28 w-full rounded-card" />
      ) : (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4 rounded-card border border-border-soft bg-bg-soft/40 px-4 py-3">
            <div className="text-xs">
              <p className="font-semibold text-ink">Nightly backup</p>
              <p className="mt-0.5 leading-relaxed text-ink-soft">
                Around 2 AM, a full copy of your spreadsheet is saved to the <span className="font-medium text-ink">Luma Backups</span> folder in Drive. The newest {status.keep} are kept.
              </p>
            </div>
            <Switch checked={status.enabled} onChange={() => void run('toggle')} label={status.enabled ? 'On' : 'Off'} />
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-card border border-border-soft px-3.5 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Last backup</p>
              <p className="mt-0.5 font-medium text-ink">{status.lastBackupAt ? formatRelativeDate(status.lastBackupAt) : 'Never'}</p>
            </div>
            <div className="rounded-card border border-border-soft px-3.5 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Copies kept</p>
              <p className="mt-0.5 font-medium text-ink">
                {status.count} of {status.keep}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" icon={<CloudUpload size={13} />} loading={busy === 'now'} loadingText="Backing up…" disabled={!!busy} onClick={() => void run('now')}>
              Back up now
            </Button>
            <Button size="sm" variant="secondary" icon={<Download size={13} />} loading={busy === 'export'} loadingText="Preparing Excel…" disabled={!!busy} onClick={() => void run('export')}>
              Download everything (Excel)
            </Button>
            {status.folderUrl && (
              <a href={status.folderUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-7 items-center gap-1.5 rounded-btn px-2.5 text-[11px] text-ink-soft hover:bg-bg-soft hover:text-ink">
                <ExternalLink size={12} /> Open backups folder
              </a>
            )}
          </div>

          {status.recent.length > 0 && (
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                <History size={11} /> Recent copies
              </p>
              <ul className="divide-y divide-border-soft rounded-card border border-border-soft">
                {status.recent.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-2 px-3.5 py-2 text-xs">
                    <span className="truncate text-ink">{b.name}</span>
                    <a href={b.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-[11px] text-rust hover:underline">
                      Open
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-[10.5px] leading-relaxed text-ink-muted">
            To restore, open a copy and use it as your spreadsheet, or copy the sheets you need back. Vault items stay encrypted in every copy.
          </p>
        </div>
      )}
    </Card>
  )
}
