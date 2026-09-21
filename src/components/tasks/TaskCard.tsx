import { Check } from 'lucide-react'
import { Badge, type BadgeVariant } from '@/components/ui/Badge'
import { formatFullDate } from '@/lib/formatDate'
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
    <div className="flex items-center gap-3.5 rounded-card border border-border bg-card px-4 py-3.5 shadow-card transition-shadow duration-200 hover:shadow-hover">
      <button
        onClick={() => onToggle(task.id)}
        aria-label={task.completed ? 'Mark task as not completed' : 'Mark task as completed'}
        aria-pressed={task.completed}
        className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
          task.completed ? 'border-success bg-success text-white' : 'border-border text-transparent hover:border-gold-dark',
        )}
      >
        <Check size={14} strokeWidth={3} />
      </button>

      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-sm font-medium text-ink', task.completed && 'text-ink-muted line-through')}>
          {task.title}
        </p>
        <p className="mt-0.5 text-xs text-ink-soft">
          {task.category} · Due {formatFullDate(task.dueDate)}
        </p>
      </div>

      <Badge variant={priority.variant} className="shrink-0">
        {priority.label}
      </Badge>
    </div>
  )
}
