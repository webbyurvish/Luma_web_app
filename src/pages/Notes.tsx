import { useMemo, useState } from 'react'
import { NotebookText, Plus, Search } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { NoteFolderList } from '@/components/notes/NoteFolderList'
import { NoteCard } from '@/components/notes/NoteCard'
import { mockNoteFolders, mockNotes } from '@/data/mockNotes'
import { useToast } from '@/context/ToastContext'

export function Notes() {
  const { showToast } = useToast()
  const [activeFolder, setActiveFolder] = useState('all')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    return mockNotes.filter((note) => {
      const matchesFolder = activeFolder === 'all' || note.folderId === activeFolder
      const matchesSearch = note.title.toLowerCase().includes(search.toLowerCase())
      return matchesFolder && matchesSearch
    })
  }, [activeFolder, search])

  return (
    <div className="flex flex-col gap-4 pt-3 lg:flex-row">
      <aside className="shrink-0 border-b border-border-soft pb-3 lg:w-48 lg:border-b-0 lg:pb-0">
        <NoteFolderList folders={mockNoteFolders} active={activeFolder} onSelect={setActiveFolder} />
      </aside>

      <div className="min-w-0 flex-1 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="sm:w-72">
            <Input icon={<Search size={15} />} placeholder="Search notes..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Button size="sm" icon={<Plus size={13} />} onClick={() => showToast('New note editor is coming in a future phase', 'info')}>
            New Note
          </Button>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={<NotebookText size={22} />} title="No notes yet" description="Create a note to keep important information handy." />
        ) : (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((note) => (
              <NoteCard key={note.id} note={note} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
