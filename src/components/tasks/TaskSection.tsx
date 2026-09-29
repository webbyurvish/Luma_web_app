import { ListChecks } from 'lucide-react'
import { TaskCard } from './TaskCard'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Task } from '@/types'

interface TaskSectionProps {
  title: string
  emptyText: string
  tasks: Task[]
  togglingId: string | null
  /** Due-date cut-off (yyyy-MM-dd): open tasks due before it are flagged overdue. */
  today: string
  onToggle: (task: Task) => void
  onEdit: (task: Task) => void
  onArchive: (task: Task) => void
  onDelete: (task: Task) => void
}

export function TaskSection({ title, emptyText, tasks, togglingId, today, onToggle, onEdit, onArchive, onDelete }: TaskSectionProps) {
  return (
    <section>
      <div className="mb-2 flex items-baseline gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft">{title}</h3>
        <span className="font-mono-figure text-[10px] text-ink-muted">{tasks.length}</span>
      </div>
      {tasks.length === 0 ? (
        <EmptyState icon={<ListChecks size={20} />} title="Nothing here" description={emptyText} />
      ) : (
        <Card>
          <div className="-my-1.5 divide-y divide-border-soft">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                toggling={togglingId === task.id}
                overdue={!task.completed && !!task.dueDate && task.dueDate < today}
                onToggle={onToggle}
                onEdit={onEdit}
                onArchive={onArchive}
                onDelete={onDelete}
              />
            ))}
          </div>
        </Card>
      )}
    </section>
  )
}
