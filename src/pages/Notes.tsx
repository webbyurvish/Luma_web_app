import { useMemo, useState } from 'react'
import { NotebookText, Plus, Search } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { NoteFolderList } from '@/components/notes/NoteFolderList'
import { NoteCard } from '@/components/notes/NoteCard'
import { NoteEditor } from '@/components/notes/NoteEditor'
import { NoteDetail } from '@/components/notes/NoteDetail'
import { NOTE_CATEGORIES } from '@/data/mockNotes'
import { useNotes } from '@/hooks/useNotes'
import { useToast } from '@/context/ToastContext'
import type { Note, NoteInput } from '@/types'

export function Notes() {
  const { showToast } = useToast()
  const { notes, createNote, updateNote, deleteNote } = useNotes()

  const [activeFolder, setActiveFolder] = useState('all')
  const [search, setSearch] = useState('')

  const [viewingNote, setViewingNote] = useState<Note | null>(null)
  const [editorTarget, setEditorTarget] = useState<Note | 'new' | null>(null)
  const [deletingNote, setDeletingNote] = useState<Note | null>(null)

  const folders = useMemo(() => {
    return [
      { id: 'all', name: 'All Notes', count: notes.length },
      ...NOTE_CATEGORIES.map((cat) => ({ id: cat.id, name: cat.name, count: notes.filter((n) => n.category === cat.id).length })),
    ]
  }, [notes])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return notes.filter((note) => {
      const matchesFolder = activeFolder === 'all' || note.category === activeFolder
      const matchesSearch =
        !query ||
        note.title.toLowerCase().includes(query) ||
        note.content.toLowerCase().includes(query) ||
        note.tags.some((tag) => tag.toLowerCase().includes(query))
      return matchesFolder && matchesSearch
    })
  }, [notes, activeFolder, search])

  const handleSave = (input: NoteInput) => {
    if (editorTarget && editorTarget !== 'new') {
      updateNote(editorTarget.id, input)
      showToast('Note updated')
      if (viewingNote?.id === editorTarget.id) setViewingNote({ ...editorTarget, ...input, updatedAt: new Date().toISOString() })
    } else {
      createNote(input)
      showToast('Note created')
    }
    setEditorTarget(null)
  }

  const handleConfirmDelete = () => {
    if (!deletingNote) return
    deleteNote(deletingNote.id)
    showToast('Note deleted')
    if (viewingNote?.id === deletingNote.id) setViewingNote(null)
    if (editorTarget !== 'new' && editorTarget?.id === deletingNote.id) setEditorTarget(null)
    setDeletingNote(null)
  }

  return (
    <div className="flex flex-col gap-4 pt-3 lg:flex-row">
      <aside className="shrink-0 border-b border-border-soft pb-3 lg:w-48 lg:border-b-0 lg:pb-0">
        <NoteFolderList folders={folders} active={activeFolder} onSelect={setActiveFolder} />
      </aside>

      <div className="min-w-0 flex-1 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="sm:w-72">
            <Input icon={<Search size={15} />} placeholder="Search notes..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Button size="sm" icon={<Plus size={13} />} onClick={() => setEditorTarget('new')}>
            New Note
          </Button>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<NotebookText size={22} />}
            title={search ? 'No notes found' : 'No notes here yet'}
            description={
              search
                ? 'Try a different search term or category.'
                : 'Create your first note to keep important information organized.'
            }
            action={
              !search && (
                <Button size="sm" icon={<Plus size={13} />} onClick={() => setEditorTarget('new')}>
                  New Note
                </Button>
              )
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onView={setViewingNote}
                onEdit={(n) => setEditorTarget(n)}
                onDelete={setDeletingNote}
              />
            ))}
          </div>
        )}
      </div>

      <NoteDetail
        open={viewingNote !== null}
        note={viewingNote}
        categories={NOTE_CATEGORIES}
        onClose={() => setViewingNote(null)}
        onEdit={(n) => {
          setViewingNote(null)
          setEditorTarget(n)
        }}
        onDelete={setDeletingNote}
      />

      <NoteEditor
        open={editorTarget !== null}
        note={editorTarget && editorTarget !== 'new' ? editorTarget : null}
        categories={NOTE_CATEGORIES}
        onClose={() => setEditorTarget(null)}
        onSave={handleSave}
      />

      <ConfirmDialog
        open={deletingNote !== null}
        title="Delete this note?"
        description="This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingNote(null)}
      />
    </div>
  )
}
