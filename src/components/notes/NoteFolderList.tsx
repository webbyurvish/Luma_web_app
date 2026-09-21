import { cn } from '@/lib/cn'
import type { NoteFolder } from '@/types'

interface NoteFolderListProps {
  folders: NoteFolder[]
  active: string
  onSelect: (id: string) => void
}

export function NoteFolderList({ folders, active, onSelect }: NoteFolderListProps) {
  return (
    <nav className="flex flex-row gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0" aria-label="Note folders">
      {folders.map((folder) => {
        const isActive = active === folder.id
        return (
          <button
            key={folder.id}
            onClick={() => onSelect(folder.id)}
            className={cn(
              'relative flex shrink-0 items-center justify-between gap-3 py-1.5 pl-3 pr-1 text-left text-xs transition-colors lg:w-full',
              isActive ? 'text-ink' : 'text-ink-soft hover:text-ink',
            )}
          >
            <span className={cn('absolute left-0 top-1/2 h-3.5 w-[2.5px] -translate-y-1/2 bg-rust transition-opacity', isActive ? 'opacity-100' : 'opacity-0')} />
            <span className="font-medium">{folder.name}</span>
            <span className="font-mono-figure text-[10px] text-ink-muted">{folder.count}</span>
          </button>
        )
      })}
    </nav>
  )
}
