import { Archive, Check, Pencil, Trash2 } from 'lucide-react'
import { Badge, type BadgeVariant } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Loader'
import { formatDate } from '@/lib/formatDate'
import { cn } from '@/lib/cn'
import type { Task, TaskPriority } from '@/types'

const priorityConfig: Record<TaskPriority, { label: string; variant: BadgeVariant }> = {
  urgent: { label: 'Urgent', variant: 'danger' },
  high: { label: 'High', variant: 'danger' },
  medium: { label: 'Medium', variant: 'warning' },
  low: { label: 'Low', variant: 'neutral' },
}

interface TaskCardProps {
  task: Task
  /** This task's checkbox is being saved. */
  toggling?: boolean
  overdue?: boolean
  onToggle: (task: Task) => void
  onEdit: (task: Task) => void
  onArchive: (task: Task) => void
  onDelete: (task: Task) => void
}

export function TaskCard({ task, toggling, overdue, onToggle, onEdit, onArchive, onDelete }: TaskCardProps) {
  const priority = priorityConfig[task.priority]
  const meta = [task.category, task.dueDate ? `Due ${formatDate(task.dueDate)}` : 'No due date'].filter(Boolean).join(' · ')

  return (
    <div className="group flex items-center gap-3 rounded-xs px-2 py-2.5 transition-colors hover:bg-ink/[0.04]">
      <button
        onClick={() => onToggle(task)}
        disabled={toggling}
        aria-label={task.completed ? 'Mark task as not completed' : 'Mark task as completed'}
        aria-pressed={task.completed}
        aria-busy={toggling || undefined}
        className={cn(
          'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors disabled:cursor-wait',
          toggling
            ? 'border-rust text-rust'
            : task.completed
              ? 'border-success bg-success text-[#F6F1E7]'
              : 'border-ink-muted text-transparent hover:border-rust',
        )}
      >
        {toggling ? <Spinner size={10} /> : <Check size={11} strokeWidth={3} />}
      </button>

      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-xs font-medium text-ink', task.completed && 'text-ink-muted line-through')}>{task.title}</p>
        <p className={cn('mt-0.5 text-[10px] uppercase tracking-[0.04em]', overdue ? 'text-danger' : 'text-ink-muted')}>{meta}</p>
      </div>

      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <button
          type="button"
          onClick={() => onEdit(task)}
          aria-label={`Edit ${task.title}`}
          className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-bg-soft hover:text-ink"
        >
          <Pencil size={13} />
        </button>
        <button
          type="button"
          onClick={() => onArchive(task)}
          aria-label={`Archive ${task.title}`}
          className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-warning-soft hover:text-warning"
        >
          <Archive size={13} />
        </button>
        <button
          type="button"
          onClick={() => onDelete(task)}
          aria-label={`Delete ${task.title} permanently`}
          title="Delete permanently"
          className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-danger-soft hover:text-danger"
        >
          <Trash2 size={13} />
        </button>
      </div>

      <Badge variant={priority.variant} className="shrink-0">
        {priority.label}
      </Badge>
    </div>
  )
}
