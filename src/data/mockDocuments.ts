import type { AppDocument } from '@/types'

export const mockDocumentCategories: { name: AppDocument['category']; count: number }[] = [
  { name: 'Insurance', count: 3 },
  { name: 'Finance', count: 5 },
  { name: 'Bills', count: 8 },
  { name: 'Personal', count: 2 },
  { name: 'Work', count: 4 },
  { name: 'Other', count: 1 },
]

export const mockDocuments: AppDocument[] = [
  { id: 'doc-001', name: 'Car Insurance.pdf', category: 'Insurance', date: '2026-09-18', size: '1.2 MB' },
  { id: 'doc-002', name: 'Health Insurance Policy.pdf', category: 'Insurance', date: '2026-08-02', size: '2.4 MB' },
  { id: 'doc-003', name: 'Salary Slip — September.pdf', category: 'Finance', date: '2026-09-02', size: '340 KB' },
  { id: 'doc-004', name: 'Fixed Deposit Certificate.pdf', category: 'Finance', date: '2026-07-14', size: '512 KB' },
  { id: 'doc-005', name: 'Electricity Bill — Sept.pdf', category: 'Bills', date: '2026-09-06', size: '210 KB' },
  { id: 'doc-006', name: 'Broadband Invoice.pdf', category: 'Bills', date: '2026-09-19', size: '180 KB' },
  { id: 'doc-007', name: 'Rental Agreement.pdf', category: 'Personal', date: '2026-04-01', size: '3.1 MB' },
  { id: 'doc-008', name: 'Offer Letter.pdf', category: 'Work', date: '2025-11-20', size: '420 KB' },
  { id: 'doc-009', name: 'Passport Copy.pdf', category: 'Personal', date: '2026-01-10', size: '1.8 MB' },
]
