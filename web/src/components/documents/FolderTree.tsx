import { type DragEvent, type ReactNode, useState } from 'react'
import { ChevronRight, Folder, FolderOpen, Library } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { DriveFolder } from '@/types'

interface FolderTreeProps {
  rootId: string
  childFolders: Map<string, DriveFolder[]>
  countDeep: (id: string) => number
  activeId: string
  /** Folders on the path to the active one — kept open so the selection is always visible. */
  openPath: Set<string>
  onSelect: (id: string) => void
  /** Files dropped from the computer onto a folder in the tree. */
  onDropFiles: (files: File[], folderId: string) => void
}

export function FolderTree({ rootId, childFolders, countDeep, activeId, openPath, onSelect, onDropFiles }: FolderTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <nav aria-label="Document folders" className="text-xs">
      <TreeRow
        id={rootId}
        label="All documents"
        icon={<Library size={14} />}
        depth={0}
        count={countDeep(rootId)}
        active={activeId === rootId}
        onSelect={onSelect}
        onDropFiles={onDropFiles}
      />
      <ul role="tree" className="mt-0.5">
        {(childFolders.get(rootId) ?? []).map((folder) => (
          <Branch
            key={folder.id}
            folder={folder}
            depth={1}
            childFolders={childFolders}
            countDeep={countDeep}
            activeId={activeId}
            isOpen={(id) => expanded.has(id) || openPath.has(id)}
            onToggle={toggle}
            onSelect={onSelect}
            onDropFiles={onDropFiles}
          />
        ))}
      </ul>
    </nav>
  )
}

interface BranchProps {
  folder: DriveFolder
  depth: number
  childFolders: Map<string, DriveFolder[]>
  countDeep: (id: string) => number
  activeId: string
  isOpen: (id: string) => boolean
  onToggle: (id: string) => void
  onSelect: (id: string) => void
  onDropFiles: (files: File[], folderId: string) => void
}

function Branch({ folder, depth, childFolders, countDeep, activeId, isOpen, onToggle, onSelect, onDropFiles }: BranchProps) {
  const children = childFolders.get(folder.id) ?? []
  const open = isOpen(folder.id)
  return (
    <li role="treeitem" aria-expanded={children.length ? open : undefined} aria-selected={activeId === folder.id}>
      <TreeRow
        id={folder.id}
        label={folder.name}
        icon={open && children.length ? <FolderOpen size={14} /> : <Folder size={14} />}
        depth={depth}
        count={countDeep(folder.id)}
        active={activeId === folder.id}
        hasChildren={children.length > 0}
        open={open}
        onToggle={() => onToggle(folder.id)}
        onSelect={onSelect}
        onDropFiles={onDropFiles}
      />
      {open && children.length > 0 && (
        <ul role="group">
          {children.map((child) => (
            <Branch
              key={child.id}
              folder={child}
              depth={depth + 1}
              childFolders={childFolders}
              countDeep={countDeep}
              activeId={activeId}
              isOpen={isOpen}
              onToggle={onToggle}
              onSelect={onSelect}
              onDropFiles={onDropFiles}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

interface TreeRowProps {
  id: string
  label: string
  icon: ReactNode
  depth: number
  count: number
  active: boolean
  hasChildren?: boolean
  open?: boolean
  onToggle?: () => void
  onSelect: (id: string) => void
  onDropFiles: (files: File[], folderId: string) => void
}

function TreeRow({ id, label, icon, depth, count, active, hasChildren, open, onToggle, onSelect, onDropFiles }: TreeRowProps) {
  const [dropHover, setDropHover] = useState(false)
  const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer.types).includes('Files')

  return (
    <div
      onDragOver={(e) => {
        if (!hasFiles(e)) return
        e.preventDefault()
        e.stopPropagation()
        setDropHover(true)
      }}
      onDragLeave={() => setDropHover(false)}
      onDrop={(e) => {
        if (!hasFiles(e)) return
        e.preventDefault()
        e.stopPropagation()
        setDropHover(false)
        onDropFiles(Array.from(e.dataTransfer.files), id)
      }}
      className={cn(
        'group flex items-center gap-1 rounded-btn pr-2 transition-colors',
        active ? 'bg-ink text-paper' : 'text-ink-soft hover:bg-bg-soft hover:text-ink',
        dropHover && 'bg-rust-soft text-rust ring-1 ring-rust/50',
      )}
      style={{ paddingLeft: `${4 + depth * 12}px` }}
    >
      <button
        type="button"
        onClick={onToggle}
        tabIndex={hasChildren ? 0 : -1}
        aria-label={hasChildren ? `${open ? 'Collapse' : 'Expand'} ${label}` : undefined}
        className={cn('flex h-6 w-4 shrink-0 items-center justify-center', !hasChildren && 'invisible')}
      >
        <ChevronRight size={12} className={cn('transition-transform', open && 'rotate-90')} />
      </button>
      <button
        type="button"
        onClick={() => onSelect(id)}
        disabled={id.startsWith('pending-')}
        className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left disabled:cursor-wait disabled:opacity-60"
      >
        <span className={cn('shrink-0', active ? 'text-paper' : 'text-rust/80')}>{icon}</span>
        <span className="truncate font-medium">{label}</span>
      </button>
      {count > 0 && <span className={cn('font-mono-figure text-[10px]', active ? 'text-paper/70' : 'text-ink-muted')}>{count}</span>}
    </div>
  )
}
