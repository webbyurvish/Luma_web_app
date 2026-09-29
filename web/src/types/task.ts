export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

/** The sheet's own status values ("Task Statuses" list). */
export type TaskStatus = 'Todo' | 'In Progress' | 'Completed' | 'Cancelled'

export interface Task {
  id: string
  title: string
  description?: string
  /** yyyy-MM-dd, optional */
  dueDate?: string
  priority: TaskPriority
  category?: string
  status: TaskStatus
  completed: boolean
}

export interface TaskInput {
  title: string
  description?: string
  dueDate?: string
  priority: TaskPriority
  category?: string
  status: TaskStatus
}
