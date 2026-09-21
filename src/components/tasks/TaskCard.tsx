import { Check } from 'lucide-react'
import { Badge, type BadgeVariant } from '@/components/ui/Badge'
import { formatDate } from '@/lib/formatDate'
import { cn } from '@/lib/cn'
import type { Task, TaskPriority } from '@/types'

const priorityConfig: Record<TaskPriority, { label: string; variant: BadgeVariant }> = {
  high: { label: 'High', variant: 'danger' },
  medium: { label: 'Medium', variant: 'warning' },
  low: { label: 'Low', variant: 'neutral' },
}

interface TaskCardProps {
  task: Task
  onToggle: (id: string) => void
}

export function TaskCard({ task, onToggle }: TaskCardProps) {
  const priority = priorityConfig[task.priority]

  return (
    <div className="flex items-center gap-3 py-2.5 transition-colors hover:bg-bg-soft">
      <button
        onClick={() => onToggle(task.id)}
        aria-label={task.completed ? 'Mark task as not completed' : 'Mark task as completed'}
        aria-pressed={task.completed}
        className={cn(
          'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors',
          task.completed ? 'border-success bg-success text-[#F6F1E7]' : 'border-ink-muted text-transparent hover:border-rust',
        )}
      >
        <Check size={11} strokeWidth={3} />
      </button>

      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-xs font-medium text-ink', task.completed && 'text-ink-muted line-through')}>{task.title}</p>
        <p className="mt-0.5 text-[10px] uppercase tracking-[0.04em] text-ink-muted">
          {task.category} · Due {formatDate(task.dueDate)}
        </p>
      </div>

      <Badge variant={priority.variant} className="shrink-0">
        {priority.label}
      </Badge>
    </div>
  )
}
