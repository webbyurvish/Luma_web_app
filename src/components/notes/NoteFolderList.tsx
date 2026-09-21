import { Folder } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { NoteFolder } from '@/types'

interface NoteFolderListProps {
  folders: NoteFolder[]
  active: string
  onSelect: (id: string) => void
}

export function NoteFolderList({ folders, active, onSelect }: NoteFolderListProps) {
  return (
    <nav className="flex flex-row gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0" aria-label="Note folders">
      {folders.map((folder) => (
        <button
          key={folder.id}
          onClick={() => onSelect(folder.id)}
          className={cn(
            'flex shrink-0 items-center justify-between gap-3 rounded-btn px-3 py-2.5 text-left text-sm font-medium transition-colors lg:w-full',
            active === folder.id ? 'bg-warning-soft text-gold-dark' : 'text-ink-soft hover:bg-bg-soft hover:text-ink',
          )}
        >
          <span className="flex items-center gap-2.5">
            <Folder size={16} />
            {folder.name}
          </span>
          <span className="text-xs text-ink-muted">{folder.count}</span>
        </button>
      ))}
    </nav>
  )
}
