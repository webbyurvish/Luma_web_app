import type { UdhaarPerson, UdhaarSummary } from '@/types'

export const mockUdhaarSummary: UdhaarSummary = {
  totalGiven: 24500,
  totalRepaid: 6000,
  toReceive: 18500,
  overdue: 4500,
}

export const mockUdhaarPeople: UdhaarPerson[] = [
  { id: 'ud-001', name: 'Rahul Mehta', given: 7000, repaid: 0, outstanding: 7000, dueDate: '2026-09-28', status: 'due-soon' },
  { id: 'ud-002', name: 'Jay Patel', given: 4500, repaid: 0, outstanding: 4500, dueDate: '2026-09-15', status: 'overdue' },
  { id: 'ud-003', name: 'Amit Sharma', given: 5000, repaid: 2000, outstanding: 3000, dueDate: '2026-10-05', status: 'pending' },
  { id: 'ud-004', name: 'Sneha Iyer', given: 3000, repaid: 3000, outstanding: 0, dueDate: '2026-09-01', status: 'settled' },
  { id: 'ud-005', name: 'Karan Verma', given: 5000, repaid: 1000, outstanding: 4000, dueDate: '2026-10-10', status: 'pending' },
]
