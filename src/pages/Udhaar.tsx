import { useState } from 'react'
import { HandCoins, Undo2 } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ErrorState } from '@/components/ui/ErrorState'
import { ListSkeleton, StatTileSkeleton } from '@/components/ui/Skeleton'
import { SlowLoadHint, SyncBadge, SyncBar } from '@/components/ui/Loader'
import { DeleteRecordDialog } from '@/components/ui/DeleteRecordDialog'
import { UdhaarTable } from '@/components/udhaar/UdhaarTable'
import { UdhaarEntryEditor } from '@/components/udhaar/UdhaarEntryEditor'
import { useUdhaar } from '@/hooks/useLifeCollections'
import { useToast } from '@/context/ToastContext'
import { getErrorMessage } from '@/lib/errors'
import { formatCurrency } from '@/lib/formatCurrency'
import type { UdhaarEntry, UdhaarEntryInput, UdhaarEntryType } from '@/types'

type EditorState = { entry: UdhaarEntry } | { newType: UdhaarEntryType; newPerson?: string } | null

export function Udhaar() {
  const { showToast } = useToast()
  const { people, summary, loading, refreshing, error, refetch, createEntry, creating, updateEntry, updating, deleteEntry, deleting } = useUdhaar()

  const [editor, setEditor] = useState<EditorState>(null)
  const [deleteTarget, setDeleteTarget] = useState<UdhaarEntry | null>(null)

  const stats = [
    { label: 'Total given', value: summary.totalGiven },
    { label: 'Total repaid', value: summary.totalRepaid, color: 'text-success' },
    { label: 'To receive', value: summary.toReceive, color: 'text-ai' },
    { label: 'Overdue', value: summary.overdue, color: 'text-danger' },
  ]

  const handleSave = async (input: UdhaarEntryInput) => {
    if (!editor) return
    try {
      if ('entry' in editor) {
        await updateEntry(editor.entry.id, input)
        showToast('Udhaar entry updated')
      } else {
        await createEntry(input)
        showToast(input.type === 'given' ? `Udhaar to ${input.person} added` : `Repayment from ${input.person} recorded`)
      }
      setEditor(null)
    } catch (err) {
      showToast(getErrorMessage(err, "Couldn't save the udhaar entry. Please try again."), 'error')
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    try {
      await deleteEntry(deleteTarget.id)
      showToast('Udhaar entry deleted')
      setDeleteTarget(null)
    } catch (err) {
      showToast(getErrorMessage(err, "Couldn't delete the udhaar entry. Please try again."), 'error')
    }
  }

  return (
    <div className="flex flex-col gap-4 pt-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <Button variant="secondary" size="sm" icon={<Undo2 size={13} />} onClick={() => setEditor({ newType: 'repayment' })}>
          Add Repayment
        </Button>
        <Button size="sm" icon={<HandCoins size={13} />} onClick={() => setEditor({ newType: 'given' })}>
          Add Udhaar
        </Button>
      </div>

      {error ? (
        <ErrorState title="Couldn't load your udhaar." description={error} onRetry={refetch} />
      ) : loading ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <StatTileSkeleton key={i} />
            ))}
          </div>
          <Card variant="panel">
            <ListSkeleton rows={4} />
            <SlowLoadHint />
          </Card>
        </>
      ) : (
        <>
          <Card variant="panel">
            <div className="grid grid-cols-2 divide-x divide-border-soft sm:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label} className="px-4 first:pl-0 sm:px-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">{stat.label}</p>
                  <p className={`mt-1.5 font-mono-figure text-lg font-bold ${stat.color ?? 'text-ink'}`}>{formatCurrency(stat.value, { compact: true })}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card variant="panel" className="relative">
            <SyncBar active={refreshing} />
            <CardHeader title="Who owes me" subtitle="Click a person to see, edit or delete their entries" action={<SyncBadge active={refreshing} />} />
            <UdhaarTable
              people={people}
              onAddRepayment={(person) => setEditor({ newType: 'repayment', newPerson: person.name })}
              onEditEntry={(entry) => setEditor({ entry })}
              onDeleteEntry={setDeleteTarget}
            />
          </Card>
        </>
      )}

      <UdhaarEntryEditor
        open={editor !== null}
        entry={editor && 'entry' in editor ? editor.entry : null}
        newType={editor && 'newType' in editor ? editor.newType : 'given'}
        newPerson={editor && 'newType' in editor ? editor.newPerson : undefined}
        knownPeople={people.map((p) => p.name)}
        onClose={() => setEditor(null)}
        onSave={handleSave}
        saving={creating || updating}
      />

      <DeleteRecordDialog
        open={deleteTarget !== null}
        recordType="udhaar entry"
        recordName={deleteTarget ? `${deleteTarget.type === 'given' ? 'Given to' : 'Repaid by'} ${deleteTarget.person} · ${formatCurrency(deleteTarget.amount)}` : undefined}
        loading={deleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
