import { useMemo, useState } from 'react'
import { Briefcase, FilePlus2, FileText, HeartPulse, Home, Landmark, Receipt, Search, ShieldCheck, User } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { ListSkeleton } from '@/components/ui/Skeleton'
import { SlowLoadHint, SyncBadge, SyncBar } from '@/components/ui/Loader'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DeleteRecordDialog } from '@/components/ui/DeleteRecordDialog'
import { DocumentCategoryCard } from '@/components/documents/DocumentCategoryCard'
import { DocumentCard } from '@/components/documents/DocumentCard'
import { DocumentEditor } from '@/components/documents/DocumentEditor'
import { useDocuments } from '@/hooks/useLifeCollections'
import { useToast } from '@/context/ToastContext'
import { getErrorMessage } from '@/lib/errors'
import { DOCUMENT_CATEGORIES, type AppDocument, type DocumentCategory, type DocumentInput } from '@/types'

const categoryStyle: Record<DocumentCategory, { icon: typeof ShieldCheck; color: string }> = {
  Personal: { icon: User, color: 'var(--color-pink)' },
  Finance: { icon: Landmark, color: 'var(--color-success)' },
  Insurance: { icon: ShieldCheck, color: 'var(--color-info)' },
  Tax: { icon: Receipt, color: 'var(--color-warning)' },
  Work: { icon: Briefcase, color: 'var(--color-ai)' },
  Medical: { icon: HeartPulse, color: 'var(--color-danger)' },
  Property: { icon: Home, color: 'var(--color-rust)' },
  Other: { icon: FileText, color: 'var(--color-ink-soft)' },
}

export function Documents() {
  const { showToast } = useToast()
  const { documents, loading, refreshing, error, refetch, createDocument, creating, updateDocument, updating, archiveDocument, archiving, deleteDocument, deleting } =
    useDocuments()

  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<DocumentCategory | null>(null)
  const [editorTarget, setEditorTarget] = useState<AppDocument | 'new' | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<AppDocument | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AppDocument | null>(null)

  const counts = useMemo(() => {
    const map = new Map<DocumentCategory, number>()
    documents.forEach((doc) => map.set(doc.category, (map.get(doc.category) ?? 0) + 1))
    return map
  }, [documents])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return documents.filter((doc) => {
      const matchesSearch = !query || [doc.name, doc.description, doc.tags].some((text) => text?.toLowerCase().includes(query))
      const matchesCategory = !activeCategory || doc.category === activeCategory
      return matchesSearch && matchesCategory
    })
  }, [documents, search, activeCategory])

  const run = async (action: () => Promise<void>, success: string, failure: string) => {
    try {
      await action()
      showToast(success)
      return true
    } catch (err) {
      showToast(getErrorMessage(err, failure), 'error')
      return false
    }
  }

  const handleSave = async (input: DocumentInput) => {
    const ok =
      editorTarget && editorTarget !== 'new'
        ? await run(() => updateDocument(editorTarget.id, input), 'Document updated', "Couldn't save the document. Please try again.")
        : await run(() => createDocument(input), 'Document added', "Couldn't add the document. Please try again.")
    if (ok) setEditorTarget(null)
  }

  const handleArchive = async () => {
    if (!archiveTarget) return
    if (await run(() => archiveDocument(archiveTarget.id), 'Document archived', "Couldn't archive the document. Please try again.")) setArchiveTarget(null)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    if (await run(() => deleteDocument(deleteTarget.id), 'Document deleted', "Couldn't delete the document. Please try again.")) setDeleteTarget(null)
  }

  return (
    <div className="relative flex flex-col gap-5 pt-3">
      <SyncBar active={refreshing} className="rounded-none" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="sm:w-80">
          <Input icon={<Search size={15} />} placeholder="Search documents..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <SyncBadge active={refreshing} />
          <Button size="sm" icon={<FilePlus2 size={13} />} onClick={() => setEditorTarget('new')}>
            Add Document
          </Button>
        </div>
      </div>

      {error ? (
        <ErrorState title="Couldn't load your documents." description={error} onRetry={refetch} />
      ) : loading ? (
        <div>
          <ListSkeleton rows={4} />
          <SlowLoadHint message="Fetching your documents…" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {DOCUMENT_CATEGORIES.map((category) => {
              const style = categoryStyle[category]
              return (
                <DocumentCategoryCard
                  key={category}
                  name={category}
                  count={counts.get(category) ?? 0}
                  icon={style.icon}
                  color={style.color}
                  active={activeCategory === category}
                  onClick={() => setActiveCategory((prev) => (prev === category ? null : category))}
                />
              )
            })}
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={<FileText size={22} />}
              title={documents.length === 0 ? 'No documents yet' : 'No documents match'}
              description={
                documents.length === 0 ? 'Add a document with a link to the file so everything important is in one place.' : 'Try a different search or category.'
              }
              action={
                documents.length === 0 && (
                  <Button icon={<FilePlus2 size={15} />} onClick={() => setEditorTarget('new')}>
                    Add Document
                  </Button>
                )
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((document) => (
                <DocumentCard key={document.id} document={document} onEdit={setEditorTarget} onArchive={setArchiveTarget} onDelete={setDeleteTarget} />
              ))}
            </div>
          )}
        </>
      )}

      <DocumentEditor
        open={editorTarget !== null}
        document={editorTarget === 'new' ? null : editorTarget}
        onClose={() => setEditorTarget(null)}
        onSave={handleSave}
        saving={creating || updating}
      />

      <ConfirmDialog
        open={archiveTarget !== null}
        title="Archive document?"
        description={`"${archiveTarget?.name}" will be hidden from your documents. It stays in your sheet, and the file itself is untouched.`}
        confirmLabel="Archive"
        loading={archiving}
        loadingLabel="Archiving…"
        onConfirm={handleArchive}
        onCancel={() => setArchiveTarget(null)}
      />

      <DeleteRecordDialog
        open={deleteTarget !== null}
        recordType="document"
        recordName={deleteTarget?.name}
        softActionLabel="Archive"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
