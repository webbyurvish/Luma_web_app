export type TaskPriority = 'low' | 'medium' | 'high'

export type TaskStatus = 'today' | 'upcoming' | 'completed'

export interface Task {
  id: string
  title: string
  dueDate: string
  priority: TaskPriority
  category: string
  status: TaskStatus
  completed: boolean
}
