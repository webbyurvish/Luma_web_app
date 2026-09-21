import { ListChecks } from 'lucide-react'
import { TaskCard } from './TaskCard'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Task } from '@/types'

interface TaskSectionProps {
  title: string
  emptyText: string
  tasks: Task[]
  onToggle: (id: string) => void
}

export function TaskSection({ title, emptyText, tasks, onToggle }: TaskSectionProps) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <span className="rounded-pill bg-bg-soft px-2 py-0.5 text-[11px] font-medium text-ink-soft">{tasks.length}</span>
      </div>
      {tasks.length === 0 ? (
        <EmptyState icon={<ListChecks size={20} />} title="Nothing here" description={emptyText} />
      ) : (
        <div className="flex flex-col gap-2.5">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onToggle={onToggle} />
          ))}
        </div>
      )}
    </section>
  )
}
