import { useState } from 'react'
import { CirclePlus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { TaskSection } from '@/components/tasks/TaskSection'
import { QuickActionModal } from '@/components/common/QuickActionModal'
import { mockTasks } from '@/data/mockTasks'
import type { Task } from '@/types'

export function Tasks() {
  const [tasks, setTasks] = useState<Task[]>(mockTasks)
  const [addOpen, setAddOpen] = useState(false)

  const toggleTask = (id: string) => {
    setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, completed: !task.completed } : task)))
  }

  const today = tasks.filter((task) => task.status === 'today')
  const upcoming = tasks.filter((task) => task.status === 'upcoming')
  const completed = tasks.filter((task) => task.status === 'completed' || task.completed)

  return (
    <div className="flex flex-col gap-5 pt-3">
      <div className="flex justify-end">
        <Button size="sm" icon={<CirclePlus size={13} />} onClick={() => setAddOpen(true)}>
          Add Task
        </Button>
      </div>

      <TaskSection title="Today" emptyText="No tasks scheduled for today." tasks={today} onToggle={toggleTask} />
      <TaskSection title="Upcoming" emptyText="Nothing coming up yet." tasks={upcoming} onToggle={toggleTask} />
      <TaskSection title="Completed" emptyText="Complete a task to see it here." tasks={completed} onToggle={toggleTask} />

      <QuickActionModal open={addOpen} kind="task" onClose={() => setAddOpen(false)} />
    </div>
  )
}
