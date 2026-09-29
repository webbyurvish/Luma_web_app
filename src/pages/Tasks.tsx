import { useMemo, useState } from 'react'
import { CirclePlus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ErrorState } from '@/components/ui/ErrorState'
import { ListSkeleton } from '@/components/ui/Skeleton'
import { SlowLoadHint, SyncBadge, SyncBar } from '@/components/ui/Loader'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DeleteRecordDialog } from '@/components/ui/DeleteRecordDialog'
import { TaskSection } from '@/components/tasks/TaskSection'
import { TaskEditor } from '@/components/tasks/TaskEditor'
import { useTasks } from '@/hooks/useLifeCollections'
import { useToast } from '@/context/ToastContext'
import { getErrorMessage } from '@/lib/errors'
import { todayIstDateKey } from '@/lib/formatDate'
import type { Task, TaskInput } from '@/types'

const byDueDate = (a: Task, b: Task) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999')

export function Tasks() {
  const { showToast } = useToast()
  const {
    tasks,
    loading,
    refreshing,
    error,
    refetch,
    createTask,
    creating,
    updateTask,
    updating,
    setTaskCompleted,
    togglingId,
    archiveTask,
    archiving,
    deleteTask,
    deleting,
  } = useTasks()

  const [editorTarget, setEditorTarget] = useState<Task | 'new' | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<Task | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null)

  const today = todayIstDateKey()
  const sections = useMemo(() => {
    const open = tasks.filter((t) => !t.completed && t.status !== 'Cancelled')
    return {
      today: open.filter((t) => t.dueDate && t.dueDate <= today).sort(byDueDate),
      upcoming: open.filter((t) => !t.dueDate || t.dueDate > today).sort(byDueDate),
      done: tasks.filter((t) => t.completed || t.status === 'Cancelled'),
    }
  }, [tasks, today])

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

  const handleSave = async (input: TaskInput) => {
    const ok =
      editorTarget && editorTarget !== 'new'
        ? await run(() => updateTask(editorTarget.id, input), 'Task updated', "Couldn't save the task. Please try again.")
        : await run(() => createTask(input), 'Task added', "Couldn't add the task. Please try again.")
    if (ok) setEditorTarget(null)
  }

  const handleToggle = (task: Task) =>
    run(
      () => setTaskCompleted(task.id, !task.completed),
      task.completed ? 'Task reopened' : 'Task completed',
      "Couldn't update the task. Please try again.",
    )

  const handleArchive = async () => {
    if (!archiveTarget) return
    if (await run(() => archiveTask(archiveTarget.id), 'Task archived', "Couldn't archive the task. Please try again.")) setArchiveTarget(null)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    if (await run(() => deleteTask(deleteTarget.id), 'Task deleted', "Couldn't delete the task. Please try again.")) setDeleteTarget(null)
  }

  const sectionProps = { togglingId, today, onToggle: handleToggle, onEdit: setEditorTarget, onArchive: setArchiveTarget, onDelete: setDeleteTarget }

  return (
    <div className="relative flex flex-col gap-5 pt-3">
      <SyncBar active={refreshing} className="rounded-none" />
      <div className="flex items-center justify-end gap-2">
        <SyncBadge active={refreshing} />
        <Button size="sm" icon={<CirclePlus size={13} />} onClick={() => setEditorTarget('new')}>
          Add Task
        </Button>
      </div>

      {error ? (
        <ErrorState title="Couldn't load your tasks." description={error} onRetry={refetch} />
      ) : loading ? (
        <Card>
          <ListSkeleton rows={5} />
          <SlowLoadHint message="Fetching your tasks…" />
        </Card>
      ) : (
        <>
          <TaskSection title="Today & overdue" emptyText="Nothing due today." tasks={sections.today} {...sectionProps} />
          <TaskSection title="Upcoming" emptyText="Nothing coming up yet." tasks={sections.upcoming} {...sectionProps} />
          <TaskSection title="Done" emptyText="Complete a task to see it here." tasks={sections.done} {...sectionProps} />
        </>
      )}

      <TaskEditor
        open={editorTarget !== null}
        task={editorTarget === 'new' ? null : editorTarget}
        onClose={() => setEditorTarget(null)}
        onSave={handleSave}
        saving={creating || updating}
      />

      <ConfirmDialog
        open={archiveTarget !== null}
        title="Archive task?"
        description={`"${archiveTarget?.title}" will be hidden from your tasks. It stays in your sheet.`}
        confirmLabel="Archive"
        loading={archiving}
        loadingLabel="Archiving…"
        onConfirm={handleArchive}
        onCancel={() => setArchiveTarget(null)}
      />

      <DeleteRecordDialog
        open={deleteTarget !== null}
        recordType="task"
        recordName={deleteTarget?.title}
        softActionLabel="Archive"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
