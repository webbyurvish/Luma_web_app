import { useState } from 'react'
import { CalendarClock, ExternalLink, Folder, FolderInput, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { KIND_STYLE, driveLinks, expiryState, formatBytes, splitTags } from './driveLinks'
import { formatDate } from '@/lib/formatDate'
import { cn } from '@/lib/cn'
import type { DriveFile, DriveFolder } from '@/types'

export type ViewMode = 'grid' | 'list'

/* ------------------------------------------------------------------ files */

function FileThumb({ file, large }: { file: DriveFile; large?: boolean }) {
  const [failed, setFailed] = useState(false)
  const style = KIND_STYLE[file.kind]
  const Icon = style.icon
  const thumb = (file.kind === 'Image' || file.kind === 'PDF') && !failed ? driveLinks.thumbnail(file.id) : null

  if (thumb && large) {
    return <img src={thumb} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="h-full w-full object-cover" />
  }
  return (
    <span className={cn('flex shrink-0 items-center justify-center rounded-btn', style.tint, large ? 'h-12 w-12' : 'h-8 w-8')}>
      <Icon size={large ? 22 : 15} />
    </span>
  )
}

export function ExpiryBadge({ expiryDate, today }: { expiryDate: string; today: string }) {
  const state = expiryState(expiryDate, today)
  if (!state) return null
  const label = state === 'expired' ? 'Expired' : state === 'soon' ? `Expires ${formatDate(expiryDate)}` : formatDate(expiryDate)
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-pill px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.04em]',
        state === 'expired' ? 'bg-danger-soft text-danger' : state === 'soon' ? 'bg-warning-soft text-warning' : 'bg-bg-soft text-ink-muted',
      )}
      title={`Expires ${formatDate(expiryDate)}`}
    >
      <CalendarClock size={10} />
      {label}
    </span>
  )
}

export interface FileActions {
  onOpen: (file: DriveFile) => void
  onEdit: (file: DriveFile) => void
  onMove: (file: DriveFile) => void
  onDelete: (file: DriveFile) => void
}

function FileMenu({ file, onEdit, onMove, onDelete }: Omit<FileActions, 'onOpen'> & { file: DriveFile }) {
  const view = driveLinks.view(file.id)
  const btn = 'rounded-full p-1.5 text-ink-muted transition-colors hover:bg-card hover:text-ink'
  return (
    <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
      {view && (
        <a href={view} target="_blank" rel="noopener noreferrer" aria-label={`Open ${file.name} in Drive`} title="Open in Drive" className={btn}>
          <ExternalLink size={13} />
        </a>
      )}
      <button type="button" onClick={() => onEdit(file)} aria-label={`Edit details of ${file.name}`} title="Edit details" className={btn}>
        <Pencil size={13} />
      </button>
      <button type="button" onClick={() => onMove(file)} aria-label={`Move ${file.name}`} title="Move to folder" className={btn}>
        <FolderInput size={13} />
      </button>
      <button
        type="button"
        onClick={() => onDelete(file)}
        aria-label={`Move ${file.name} to Drive trash`}
        title="Move to Drive trash"
        className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-danger-soft hover:text-danger"
      >
        <Trash2 size={13} />
      </button>
    </div>
  )
}

interface FileItemProps extends FileActions {
  file: DriveFile
  view: ViewMode
  today: string
  /** Folder path, shown in search results where files come from many folders. */
  path?: string
}

export function FileItem({ file, view, today, path, ...actions }: FileItemProps) {
  const tags = splitTags(file.tags)
  const open = () => actions.onOpen(file)

  if (view === 'list') {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={open}
        onKeyDown={(e) => e.key === 'Enter' && open()}
        className="group flex cursor-pointer items-center gap-3 rounded-btn px-2 py-2 transition-colors hover:bg-bg-soft"
      >
        <FileThumb file={file} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-ink">{file.name}</p>
          <p className="truncate text-[10.5px] text-ink-muted">
            {path && <span className="text-ink-soft">{path} · </span>}
            {file.kind} · {formatBytes(file.size)} · {formatDate(file.updatedAt)}
          </p>
        </div>
        <div className="hidden shrink-0 items-center gap-1 sm:flex">
          {tags.slice(0, 2).map((t) => (
            <span key={t} className="rounded-pill bg-bg-soft px-2 py-0.5 text-[10px] text-ink-soft">
              {t}
            </span>
          ))}
          <ExpiryBadge expiryDate={file.expiryDate} today={today} />
        </div>
        <div className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <FileMenu file={file} {...actions} />
        </div>
      </div>
    )
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => e.key === 'Enter' && open()}
      className="group flex cursor-pointer flex-col overflow-hidden rounded-card border border-border-soft bg-card shadow-card transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-border hover:shadow-hover"
    >
      <div className="relative flex h-28 items-center justify-center overflow-hidden border-b border-border-soft bg-bg-soft/60">
        <FileThumb file={file} large />
        <div className="absolute right-1.5 top-1.5 rounded-pill bg-card/90 opacity-0 shadow-xs backdrop-blur transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <FileMenu file={file} {...actions} />
        </div>
      </div>
      <div className="flex min-h-[68px] flex-col gap-1 px-3 py-2.5">
        <p className="line-clamp-2 text-xs font-medium leading-snug text-ink" title={file.name}>
          {file.name}
        </p>
        <p className="text-[10px] text-ink-muted">
          {path && <span className="text-ink-soft">{path} · </span>}
          {formatBytes(file.size)} · {formatDate(file.updatedAt)}
        </p>
        {(tags.length > 0 || file.expiryDate) && (
          <div className="mt-auto flex flex-wrap items-center gap-1 pt-1">
            <ExpiryBadge expiryDate={file.expiryDate} today={today} />
            {tags.slice(0, 3).map((t) => (
              <span key={t} className="rounded-pill bg-bg-soft px-1.5 py-0.5 text-[9.5px] text-ink-soft">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- folders */

export interface FolderActions {
  onOpen: (folder: DriveFolder) => void
  onRename: (folder: DriveFolder) => void
  onMove: (folder: DriveFolder) => void
  onDelete: (folder: DriveFolder) => void
}

interface FolderItemProps extends FolderActions {
  folder: DriveFolder
  count: number
  subfolders: number
  view: ViewMode
}

export function FolderItem({ folder, count, subfolders, view, ...actions }: FolderItemProps) {
  const [menu, setMenu] = useState(false)
  const parts = [subfolders ? `${subfolders} folder${subfolders > 1 ? 's' : ''}` : '', `${count} document${count === 1 ? '' : 's'}`]
  const menuItems = [
    { label: 'Rename', icon: Pencil, run: actions.onRename, danger: false },
    { label: 'Move to…', icon: FolderInput, run: actions.onMove, danger: false },
    { label: 'Move to trash', icon: Trash2, run: actions.onDelete, danger: true },
  ]

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => actions.onOpen(folder)}
      onKeyDown={(e) => e.key === 'Enter' && actions.onOpen(folder)}
      onMouseLeave={() => setMenu(false)}
      className={cn(
        'group relative flex cursor-pointer items-center gap-3 rounded-card border border-border-soft bg-card transition-[border-color,box-shadow] hover:border-border hover:shadow-hover',
        view === 'grid' ? 'px-3 py-3' : 'px-2.5 py-2',
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-btn bg-rust-soft/70 text-rust">
        <Folder size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-ink">{folder.name}</p>
        <p className="text-[10px] text-ink-muted">{parts.filter(Boolean).join(' · ')}</p>
      </div>
      <button
        type="button"
        aria-label={`Actions for ${folder.name}`}
        aria-expanded={menu}
        onClick={(e) => {
          e.stopPropagation()
          setMenu((v) => !v)
        }}
        className="rounded-full p-1.5 text-ink-muted opacity-0 transition-opacity hover:bg-bg-soft hover:text-ink group-hover:opacity-100 focus-visible:opacity-100"
      >
        <MoreHorizontal size={14} />
      </button>
      {menu && (
        <div
          role="menu"
          onClick={(e) => e.stopPropagation()}
          className="absolute right-2 top-11 z-20 w-40 overflow-hidden rounded-btn border border-border bg-card py-1 shadow-dropdown"
        >
          {menuItems.map(({ label, icon: Icon, run, danger }) => (
            <button
              key={label}
              role="menuitem"
              type="button"
              onClick={() => {
                setMenu(false)
                run(folder)
              }}
              className={cn('flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-bg-soft', danger ? 'text-danger' : 'text-ink')}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
