import type { Task } from '@/types'

export const mockTasks: Task[] = [
  { id: 'tk-001', title: 'Pay electricity bill', dueDate: '2026-09-22', priority: 'high', category: 'Bills', status: 'today', completed: false },
  { id: 'tk-002', title: 'Call Rahul about udhaar repayment', dueDate: '2026-09-22', priority: 'medium', category: 'Udhaar', status: 'today', completed: false },
  { id: 'tk-003', title: 'Review monthly budget', dueDate: '2026-09-22', priority: 'low', category: 'Finance', status: 'today', completed: true },
  { id: 'tk-004', title: 'Renew car insurance', dueDate: '2026-09-25', priority: 'high', category: 'Documents', status: 'upcoming', completed: false },
  { id: 'tk-005', title: 'Book dentist appointment', dueDate: '2026-09-27', priority: 'medium', category: 'Health', status: 'upcoming', completed: false },
  { id: 'tk-006', title: 'Plan festival shopping budget', dueDate: '2026-09-30', priority: 'low', category: 'Finance', status: 'upcoming', completed: false },
  { id: 'tk-007', title: 'Update emergency fund note', dueDate: '2026-10-03', priority: 'low', category: 'Notes', status: 'upcoming', completed: false },
  { id: 'tk-008', title: 'Pay internet bill', dueDate: '2026-09-19', priority: 'high', category: 'Bills', status: 'completed', completed: true },
  { id: 'tk-009', title: 'Transfer rent to landlord', dueDate: '2026-09-05', priority: 'high', category: 'Bills', status: 'completed', completed: true },
  { id: 'tk-010', title: 'Upload salary slip to documents', dueDate: '2026-09-02', priority: 'low', category: 'Documents', status: 'completed', completed: true },
]
