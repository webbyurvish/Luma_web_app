import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, CheckCircle2, Clock, X } from 'lucide-react'
import { Spinner } from '@/components/ui/Loader'
import { formatBytes } from './driveLinks'
import type { UploadItem } from '@/hooks/useDriveDocuments'

/** Floating progress card for the upload queue (files go up one at a time). */
export function UploadTray({ uploads, onClear }: { uploads: UploadItem[]; onClear: () => void }) {
  const active = uploads.filter((u) => u.status === 'queued' || u.status === 'uploading').length
  const done = uploads.filter((u) => u.status === 'done').length
  const failed = uploads.filter((u) => u.status === 'error').length

  return (
    <AnimatePresence>
      {uploads.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          className="fixed bottom-5 left-5 z-40 w-[320px] overflow-hidden rounded-card border border-border bg-card shadow-hover"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center justify-between border-b border-border-soft px-3.5 py-2.5">
            <p className="text-xs font-medium text-ink">
              {active ? `Uploading ${done + 1} of ${done + active}…` : failed ? `${done} uploaded · ${failed} failed` : `${done} uploaded to Drive`}
            </p>
            {!active && (
              <button type="button" onClick={onClear} aria-label="Close upload list" className="rounded-full p-1 text-ink-muted hover:bg-bg-soft hover:text-ink">
                <X size={13} />
              </button>
            )}
          </div>
          <ul className="max-h-56 overflow-y-auto">
            {uploads.map((u) => (
              <li key={u.id} className="flex items-center gap-2.5 px-3.5 py-2 text-[11px]">
                <span className="shrink-0">
                  {u.status === 'uploading' ? (
                    <Spinner size={13} className="text-rust" />
                  ) : u.status === 'done' ? (
                    <CheckCircle2 size={13} className="text-success" />
                  ) : u.status === 'error' ? (
                    <AlertCircle size={13} className="text-danger" />
                  ) : (
                    <Clock size={13} className="text-ink-muted" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-ink">{u.name}</p>
                  <p className={u.status === 'error' ? 'text-danger' : 'text-ink-muted'}>{u.error ?? formatBytes(u.size)}</p>
                </div>
              </li>
            ))}
          </ul>
          {active > 0 && (
            <div className="h-[2px] bg-rust-soft">
              <div className="h-full bg-rust transition-[width] duration-500" style={{ width: `${(done / (done + active)) * 100}%` }} />
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
