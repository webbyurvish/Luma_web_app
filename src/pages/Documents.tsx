import { type DragEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarClock, ChevronRight, ExternalLink, FolderPlus, LayoutGrid, List, RefreshCw, Search, UploadCloud } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Skeleton } from '@/components/ui/Skeleton'
import { SlowLoadHint, SyncBadge } from '@/components/ui/Loader'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { FolderTree } from '@/components/documents/FolderTree'
import { FileItem, FolderItem, ExpiryBadge, type ViewMode } from '@/components/documents/DocumentItems'
import { FileDetailsPanel } from '@/components/documents/FileDetailsPanel'
import { FolderNameDialog, FolderPickerDialog } from '@/components/documents/FolderDialogs'
import { UploadTray } from '@/components/documents/UploadTray'
import { driveLinks, expiryState } from '@/components/documents/driveLinks'
import { useDriveDocuments } from '@/hooks/useDriveDocuments'
import { useToast } from '@/context/ToastContext'
import { getErrorMessage } from '@/lib/errors'
import { todayIstDateKey } from '@/lib/formatDate'
import { cn } from '@/lib/cn'
import type { DriveFile, DriveFileDetails, DriveFolder } from '@/types'

const VIEW_KEY = 'luma:documents:view'

function loadView(): ViewMode {
  try {
    return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid'
  } catch {
    return 'grid'
  }
}

type Dialog =
  | { type: 'newFolder' }
  | { type: 'renameFolder'; folder: DriveFolder }
  | { type: 'moveFolder'; folder: DriveFolder }
  | { type: 'trashFolder'; folder: DriveFolder }
  | { type: 'moveFile'; file: DriveFile }
  | { type: 'trashFile'; file: DriveFile }
  | null

export function Documents() {
  const { showToast } = useToast()
  const drive = useDriveDocuments()
  const { tree, folderById, childFolders, filesIn, pathTo, countDeep } = drive
  const today = todayIstDateKey()

  const [currentId, setCurrentId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [view, setView] = useState<ViewMode>(loadView)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [openFile, setOpenFile] = useState<{ file: DriveFile; edit: boolean } | null>(null)
  const [dragging, setDragging] = useState(false)
  const dragDepth = useRef(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const rootId = tree?.rootId ?? ''
  // Fall back to the root when the open folder disappears (trashed here or in Drive).
  const folderId = currentId && folderById.has(currentId) ? currentId : rootId
  const breadcrumb = useMemo(() => (folderId ? pathTo(folderId) : []), [folderId, pathTo])
  const openPath = useMemo(() => new Set(breadcrumb.map((f) => f.id)), [breadcrumb])
  const pathLabel = (id: string) =>
    pathTo(id)
      .slice(1)
      .map((f) => f.name)
      .join(' / ')

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, view)
    } catch {
      // Remembering the view is a nicety; ignore blocked storage.
    }
  }, [view])

  // "Add document" from the Dashboard lands here with a request to open the file picker.
  const location = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    if ((location.state as { upload?: boolean } | null)?.upload && tree) {
      navigate('.', { replace: true, state: null })
      fileInputRef.current?.click()
    }
  }, [location.state, tree, navigate])

  const query = search.trim().toLowerCase()
  const searchResults = useMemo(() => {
    if (!query || !tree) return []
    return tree.files.filter((f) => [f.name, f.description, f.tags, pathLabel(f.folderId)].some((text) => text.toLowerCase().includes(query)))
    // pathLabel depends only on the tree, which is already a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, tree])

  const expiring = useMemo(
    () =>
      (tree?.files ?? [])
        .filter((f) => {
          const state = expiryState(f.expiryDate, today)
          return state === 'expired' || state === 'soon'
        })
        .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate)),
    [tree, today],
  )

  const folders = childFolders.get(folderId) ?? []
  const files = filesIn.get(folderId) ?? []
  const currentName = folderId === rootId ? 'Luma Documents' : (folderById.get(folderId)?.name ?? '')

  /* ---------------------------------------------------------- actions */

  const run = async (action: () => Promise<unknown>, success: string, failure: string) => {
    try {
      await action()
      showToast(success)
      return true
    } catch (err) {
      showToast(getErrorMessage(err, failure), 'error')
      return false
    }
  }

  const upload = (list: FileList | File[] | null, targetId = folderId) => {
    const picked = Array.from(list ?? [])
    if (!picked.length || !targetId) return
    drive.uploadFiles(picked, targetId)
  }

  const saveDetails = async (details: Partial<DriveFileDetails>) => {
    if (!openFile) return
    if (await run(() => drive.updateFile(openFile.file.id, details), 'Details saved', "Couldn't save the details.")) setOpenFile(null)
  }

  const descendantsOf = (id: string): Set<string> => {
    const out = new Set<string>([id])
    const walk = (fid: string) => (childFolders.get(fid) ?? []).forEach((c) => (out.add(c.id), walk(c.id)))
    walk(id)
    return out
  }

  /* ------------------------------------------------------ drag & drop */

  const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer.types).includes('Files')
  const dropHandlers = {
    onDragEnter: (e: DragEvent) => {
      if (!hasFiles(e)) return
      dragDepth.current++
      setDragging(true)
    },
    onDragOver: (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault()
    },
    onDragLeave: () => {
      dragDepth.current = Math.max(0, dragDepth.current - 1)
      if (dragDepth.current === 0) setDragging(false)
    },
    onDrop: (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      dragDepth.current = 0
      setDragging(false)
      upload(e.dataTransfer.files)
    },
  }

  const fileActions = {
    onOpen: (file: DriveFile) => setOpenFile({ file, edit: false }),
    onEdit: (file: DriveFile) => setOpenFile({ file, edit: true }),
    onMove: (file: DriveFile) => setDialog({ type: 'moveFile', file }),
    onDelete: (file: DriveFile) => setDialog({ type: 'trashFile', file }),
  }
  const folderActions = {
    onOpen: (folder: DriveFolder) => {
      setCurrentId(folder.id)
      setSearch('')
    },
    onRename: (folder: DriveFolder) => setDialog({ type: 'renameFolder', folder }),
    onMove: (folder: DriveFolder) => setDialog({ type: 'moveFolder', folder }),
    onDelete: (folder: DriveFolder) => setDialog({ type: 'trashFolder', folder }),
  }

  /* ------------------------------------------------------------ render */

  if (drive.error) {
    return (
      <div className="pt-3">
        <ErrorState title="Couldn't load your documents." description={drive.error} onRetry={drive.refetch} />
      </div>
    )
  }

  if (drive.loading || !tree) {
    return (
      <div className="grid grid-cols-1 gap-4 pt-3 lg:grid-cols-[220px_1fr]">
        <div className="hidden space-y-2 lg:block">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-full rounded-btn" />
          ))}
        </div>
        <div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-card" />
            ))}
          </div>
          <SlowLoadHint message="Opening Luma Documents in your Google Drive…" />
        </div>
      </div>
    )
  }

  const gridClass = view === 'grid' ? 'grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4' : 'flex flex-col'

  return (
    <div className="grid grid-cols-1 gap-5 pt-3 lg:grid-cols-[220px_1fr]">
      <aside className="hidden lg:block">
        <div className="sticky top-3 max-h-[calc(100vh-110px)] overflow-y-auto pr-1">
          <FolderTree
            rootId={rootId}
            childFolders={childFolders}
            countDeep={countDeep}
            activeId={query ? '' : folderId}
            openPath={openPath}
            onSelect={(id) => {
              setCurrentId(id)
              setSearch('')
            }}
            onDropFiles={(dropped, target) => upload(dropped, target)}
          />
          <p className="mt-4 px-2 text-[10.5px] leading-relaxed text-ink-muted">Drop files onto any folder to upload them there.</p>
        </div>
      </aside>

      <section className="relative min-w-0" {...dropHandlers}>
        {/* Toolbar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="sm:w-80">
            <Input icon={<Search size={15} />} placeholder="Search all documents, tags, folders…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SyncBadge active={drive.refreshing} />
            <div className="flex rounded-btn border border-border p-0.5" role="group" aria-label="View">
              {(['grid', 'list'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setView(mode)}
                  aria-pressed={view === mode}
                  aria-label={mode === 'grid' ? 'Grid view' : 'List view'}
                  className={cn('rounded-[6px] p-1.5 transition-colors', view === mode ? 'bg-ink text-paper' : 'text-ink-muted hover:text-ink')}
                >
                  {mode === 'grid' ? <LayoutGrid size={13} /> : <List size={13} />}
                </button>
              ))}
            </div>
            <Button variant="ghost" size="sm" icon={<RefreshCw size={12} />} onClick={() => void drive.refetch()} disabled={drive.refreshing} title="Pick up changes made in Google Drive">
              Refresh
            </Button>
            <Button variant="secondary" size="sm" icon={<FolderPlus size={13} />} onClick={() => setDialog({ type: 'newFolder' })}>
              New folder
            </Button>
            <Button size="sm" icon={<UploadCloud size={13} />} onClick={() => fileInputRef.current?.click()}>
              Upload
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={(e) => {
                upload(e.target.files)
                e.target.value = ''
              }}
            />
          </div>
        </div>

        {/* Expiring soon */}
        {!query && expiring.length > 0 && (
          <Card variant="inset" className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <p className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-warning">
              <CalendarClock size={13} /> Renew soon
            </p>
            <div className="flex min-w-0 flex-wrap gap-2">
              {expiring.slice(0, 6).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setOpenFile({ file: f, edit: false })}
                  className="inline-flex max-w-[260px] items-center gap-2 rounded-pill border border-border-soft bg-card px-2.5 py-1 text-[11px] text-ink hover:border-border"
                >
                  <span className="truncate">{f.name}</span>
                  <ExpiryBadge expiryDate={f.expiryDate} today={today} />
                </button>
              ))}
            </div>
          </Card>
        )}

        {/* Breadcrumbs */}
        {!query && (
          <div className="mt-5 flex items-center justify-between gap-3">
            <nav aria-label="Folder path" className="flex min-w-0 flex-wrap items-center gap-1 text-xs">
              {breadcrumb.map((f, i) => (
                <span key={f.id} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight size={12} className="text-ink-muted" />}
                  <button
                    type="button"
                    onClick={() => setCurrentId(f.id)}
                    className={cn('rounded-xs px-1 py-0.5 hover:bg-bg-soft', i === breadcrumb.length - 1 ? 'font-display text-base italic text-ink' : 'text-ink-soft')}
                  >
                    {i === 0 ? 'Luma Documents' : f.name}
                  </button>
                </span>
              ))}
            </nav>
            {driveLinks.folder(folderId) && (
              <a
                href={driveLinks.folder(folderId)!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1 text-[11px] text-ink-muted hover:text-rust"
                title="Open this folder in Google Drive — you can move existing files in there"
              >
                <ExternalLink size={12} /> Open in Drive
              </a>
            )}
          </div>
        )}

        {/* Content */}
        <div className="mt-3">
          {query ? (
            <>
              <p className="mb-3 text-[11px] text-ink-muted">
                {searchResults.length} result{searchResults.length === 1 ? '' : 's'} for “{search.trim()}” across all folders
              </p>
              {searchResults.length === 0 ? (
                <EmptyState icon={<Search size={20} />} title="Nothing matches" description="Try a different word — names, tags, descriptions and folder names are all searched." />
              ) : (
                <div className={gridClass}>
                  {searchResults.map((file) => (
                    <FileItem key={file.id} file={file} view={view} today={today} path={pathLabel(file.folderId) || 'Luma Documents'} {...fileActions} />
                  ))}
                </div>
              )}
            </>
          ) : folders.length === 0 && files.length === 0 ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center rounded-hero border-2 border-dashed border-border px-6 py-14 text-center transition-colors hover:border-rust/50 hover:bg-rust-soft/20"
            >
              <UploadCloud size={28} className="text-rust" />
              <p className="mt-3 font-display text-lg italic text-ink">{currentName} is empty</p>
              <p className="mt-1 max-w-sm text-xs text-ink-soft">Drag files here, or click to upload. You can also add sub-folders with “New folder”.</p>
            </button>
          ) : (
            <div className="flex flex-col gap-5">
              {folders.length > 0 && (
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-muted">Folders</p>
                  <div className={view === 'grid' ? 'grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3' : 'flex flex-col gap-1.5'}>
                    {folders.map((folder) => (
                      <FolderItem
                        key={folder.id}
                        folder={folder}
                        view={view}
                        count={countDeep(folder.id)}
                        subfolders={(childFolders.get(folder.id) ?? []).length}
                        {...folderActions}
                      />
                    ))}
                  </div>
                </div>
              )}
              {files.length > 0 && (
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-muted">Documents · {files.length}</p>
                  <div className={cn(gridClass, view === 'list' && 'divide-y divide-border-soft rounded-card border border-border-soft bg-card px-1')}>
                    {files.map((file) => (
                      <FileItem key={file.id} file={file} view={view} today={today} {...fileActions} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Drop overlay */}
        <AnimatePresence>
          {dragging && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-hero border-2 border-dashed border-rust bg-rust-soft/60 backdrop-blur-[2px]"
            >
              <div className="text-center">
                <UploadCloud size={34} className="mx-auto text-rust" />
                <p className="mt-2 font-display text-xl italic text-ink">Drop to upload into {currentName}</p>
                <p className="mt-1 text-xs text-ink-soft">Up to 10 MB per file</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Panels & dialogs */}
      <FileDetailsPanel
        file={openFile?.file ?? null}
        path={openFile ? pathLabel(openFile.file.folderId) : ''}
        today={today}
        startEditing={openFile?.edit}
        saving={drive.fileBusy}
        onClose={() => setOpenFile(null)}
        onSave={saveDetails}
        onMove={(file) => setDialog({ type: 'moveFile', file })}
        onDelete={(file) => setDialog({ type: 'trashFile', file })}
      />

      <FolderNameDialog
        open={dialog?.type === 'newFolder'}
        title="New folder"
        subtitle={`Inside ${currentName}`}
        confirmLabel="Create folder"
        saving={drive.folderBusy}
        onCancel={() => setDialog(null)}
        onConfirm={async (name) => {
          if (await run(() => drive.createFolder(folderId, name), `Folder “${name}” created`, "Couldn't create the folder.")) setDialog(null)
        }}
      />

      <FolderNameDialog
        open={dialog?.type === 'renameFolder'}
        title="Rename folder"
        initialName={dialog?.type === 'renameFolder' ? dialog.folder.name : ''}
        confirmLabel="Rename"
        saving={drive.folderBusy}
        onCancel={() => setDialog(null)}
        onConfirm={async (name) => {
          if (dialog?.type !== 'renameFolder') return
          if (await run(() => drive.renameFolder(dialog.folder.id, name), 'Folder renamed', "Couldn't rename the folder.")) setDialog(null)
        }}
      />

      <FolderPickerDialog
        open={dialog?.type === 'moveFolder' || dialog?.type === 'moveFile'}
        title={dialog?.type === 'moveFolder' ? `Move “${dialog.folder.name}”` : dialog?.type === 'moveFile' ? `Move “${dialog.file.name}”` : ''}
        rootId={rootId}
        childFolders={childFolders}
        disabledIds={
          dialog?.type === 'moveFolder'
            ? new Set([...descendantsOf(dialog.folder.id), dialog.folder.parentId ?? ''])
            : dialog?.type === 'moveFile'
              ? new Set([dialog.file.folderId])
              : new Set()
        }
        saving={drive.folderBusy || drive.fileBusy}
        onCancel={() => setDialog(null)}
        onPick={async (targetId) => {
          const target = targetId === rootId ? 'Luma Documents' : folderById.get(targetId)?.name
          if (dialog?.type === 'moveFolder') {
            if (await run(() => drive.moveFolder(dialog.folder.id, targetId), `Moved to ${target}`, "Couldn't move the folder.")) setDialog(null)
          } else if (dialog?.type === 'moveFile') {
            if (await run(() => drive.moveFile(dialog.file.id, targetId), `Moved to ${target}`, "Couldn't move the file.")) {
              setDialog(null)
              setOpenFile(null)
            }
          }
        }}
      />

      <ConfirmDialog
        open={dialog?.type === 'trashFile'}
        title="Move to Drive trash?"
        description={
          dialog?.type === 'trashFile'
            ? `“${dialog.file.name}” goes to your Google Drive trash. You can restore it from there for 30 days.`
            : ''
        }
        confirmLabel="Move to trash"
        loading={drive.fileBusy}
        loadingLabel="Moving…"
        onCancel={() => setDialog(null)}
        onConfirm={async () => {
          if (dialog?.type !== 'trashFile') return
          if (await run(() => drive.trashFile(dialog.file.id), 'Moved to Drive trash', "Couldn't move the file to trash.")) {
            setDialog(null)
            setOpenFile(null)
          }
        }}
      />

      <ConfirmDialog
        open={dialog?.type === 'trashFolder'}
        title="Move folder to Drive trash?"
        description={
          dialog?.type === 'trashFolder'
            ? `“${dialog.folder.name}” and everything inside it (${countDeep(dialog.folder.id)} document${countDeep(dialog.folder.id) === 1 ? '' : 's'}) go to your Google Drive trash. You can restore them from there for 30 days.`
            : ''
        }
        confirmLabel="Move to trash"
        loading={drive.folderBusy}
        loadingLabel="Moving…"
        onCancel={() => setDialog(null)}
        onConfirm={async () => {
          if (dialog?.type !== 'trashFolder') return
          const folder = dialog.folder
          if (await run(() => drive.trashFolder(folder.id), 'Folder moved to Drive trash', "Couldn't move the folder to trash.")) {
            setDialog(null)
            if (openPath.has(folder.id)) setCurrentId(folder.parentId)
          }
        }}
      />

      <UploadTray uploads={drive.uploads} onClear={drive.clearFinishedUploads} />
    </div>
  )
}

