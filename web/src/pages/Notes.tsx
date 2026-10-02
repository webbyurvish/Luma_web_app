import { useEffect, useMemo, useState } from 'react'
import { NotebookText, Plus, Search } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DeleteRecordDialog } from '@/components/ui/DeleteRecordDialog'
import { Skeleton } from '@/components/ui/Skeleton'
import { SlowLoadHint, SyncBar } from '@/components/ui/Loader'
import { getErrorMessage } from '@/lib/errors'
import { NoteFolderList } from '@/components/notes/NoteFolderList'
import { NoteCard } from '@/components/notes/NoteCard'
import { NoteEditor } from '@/components/notes/NoteEditor'
import { NoteDetail } from '@/components/notes/NoteDetail'
import { NOTE_CATEGORIES } from '@/data/mockNotes'
import { useNotes } from '@/hooks/useNotes'
import { useRouteIntent } from '@/hooks/useRouteIntent'
import { useToast } from '@/context/ToastContext'
import type { Note, NoteInput } from '@/types'

export function Notes() {
  const { showToast } = useToast()
  const { notes, loading, refreshing, error, refetch, createNote, creating, updateNote, updating, archiveNote, archiving, deleteNote, deleting } = useNotes()

  const [activeFolder, setActiveFolder] = useState('all')
  const [search, setSearch] = useState('')

  const [viewingNote, setViewingNote] = useState<Note | null>(null)
  // The palette can open one note directly; it may arrive before the notes have loaded.
  const [pendingNoteId, setPendingNoteId] = useState<string | null>(null)
  useRouteIntent((intent) => {
    if (intent.search !== undefined) setSearch(intent.search)
    if (intent.openId) setPendingNoteId(intent.openId)
  })
  useEffect(() => {
    if (!pendingNoteId) return
    const note = notes.find((n) => n.id === pendingNoteId)
    if (note) {
      setViewingNote(note)
      setPendingNoteId(null)
    }
  }, [pendingNoteId, notes])
  const [editorTarget, setEditorTarget] = useState<Note | 'new' | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<Note | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null)

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

  const handleSave = async (input: NoteInput) => {
    try {
      if (editorTarget && editorTarget !== 'new') {
        await updateNote(editorTarget.id, input)
        showToast('Note updated')
        if (viewingNote?.id === editorTarget.id) setViewingNote({ ...editorTarget, ...input, updatedAt: new Date().toISOString() })
      } else {
        await createNote(input)
        showToast('Note created')
      }
      setEditorTarget(null)
    } catch (err) {
      showToast(getErrorMessage(err, "Couldn't save the note. Please try again."), 'error')
    }
  }

  const handleConfirmArchive = async () => {
    if (!archiveTarget) return
    try {
      await archiveNote(archiveTarget.id)
      showToast('Note archived')
      if (viewingNote?.id === archiveTarget.id) setViewingNote(null)
      if (editorTarget !== 'new' && editorTarget?.id === archiveTarget.id) setEditorTarget(null)
      setArchiveTarget(null)
    } catch (err) {
      showToast(getErrorMessage(err, "Couldn't archive the note. Please try again."), 'error')
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    try {
      await deleteNote(deleteTarget.id)
      showToast('Note deleted')
      if (editorTarget !== 'new' && editorTarget?.id === deleteTarget.id) setEditorTarget(null)
      setDeleteTarget(null)
    } catch (err) {
      showToast(getErrorMessage(err, "Couldn't delete the note. Please try again."), 'error')
    }
  }

  if (error) {
    return <ErrorState title="Couldn't load your notes." description={error} onRetry={refetch} />
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4 pt-3 lg:flex-row">
        <aside className="shrink-0 space-y-2 lg:w-48">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-7 w-full rounded-btn" />
          ))}
        </aside>
        <div className="min-w-0 flex-1">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-card border border-border-soft bg-card p-4">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="mt-3 h-2.5 w-full" />
                <Skeleton className="mt-1.5 h-2.5 w-4/5" />
                <Skeleton className="mt-4 h-2.5 w-1/3" />
              </div>
            ))}
          </div>
          <SlowLoadHint message="Opening your notebook…" />
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex flex-col gap-4 pt-3 lg:flex-row">
      <SyncBar active={refreshing} className="top-0 rounded-none" />
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
                onArchive={setArchiveTarget}
                onDelete={setDeleteTarget}
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
        onArchive={setArchiveTarget}
        onDelete={(n) => {
          setViewingNote(null)
          setDeleteTarget(n)
        }}
      />

      <NoteEditor
        open={editorTarget !== null}
        note={editorTarget && editorTarget !== 'new' ? editorTarget : null}
        categories={NOTE_CATEGORIES}
        onClose={() => setEditorTarget(null)}
        onSave={handleSave}
        saving={creating || updating}
      />

      <ConfirmDialog
        open={archiveTarget !== null}
        title="Archive this note?"
        description={`"${archiveTarget?.title}" will be hidden from your notes. It stays in your records and can be restored from the sheet.`}
        confirmLabel="Archive"
        loading={archiving}
        loadingLabel="Archiving…"
        onConfirm={handleConfirmArchive}
        onCancel={() => setArchiveTarget(null)}
      />

      <DeleteRecordDialog
        open={deleteTarget !== null}
        recordType="note"
        recordName={deleteTarget?.title}
        softActionLabel="Archive"
        loading={deleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
