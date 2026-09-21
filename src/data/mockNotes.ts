import type { Note, NoteFolder } from '@/types'

export const mockNoteFolders: NoteFolder[] = [
  { id: 'all', name: 'All Notes', count: 6 },
  { id: 'finance', name: 'Finance', count: 2 },
  { id: 'personal', name: 'Personal', count: 2 },
  { id: 'contacts', name: 'Contacts', count: 1 },
  { id: 'home', name: 'Home', count: 1 },
]

export const mockNotes: Note[] = [
  { id: 'nt-001', title: 'Car Information', excerpt: 'Registration number, insurance renewal date, service center contact...', folderId: 'personal', updatedAt: '2026-09-14' },
  { id: 'nt-002', title: 'Investment Notes', excerpt: 'SIP allocations, mutual fund folios, and yearly review reminders...', folderId: 'finance', updatedAt: '2026-09-10' },
  { id: 'nt-003', title: 'Home Information', excerpt: 'Society maintenance contact, Wi-Fi password, appliance warranties...', folderId: 'home', updatedAt: '2026-09-05' },
  { id: 'nt-004', title: 'Important Contacts', excerpt: 'Family doctor, electrician, plumber, and society office numbers...', folderId: 'contacts', updatedAt: '2026-08-29' },
  { id: 'nt-005', title: 'Tax Filing Checklist', excerpt: 'Form 16, investment proofs, rent receipts for this financial year...', folderId: 'finance', updatedAt: '2026-08-20' },
  { id: 'nt-006', title: 'Travel Wishlist', excerpt: 'Places to visit next year, rough budget, and best months to travel...', folderId: 'personal', updatedAt: '2026-08-11' },
]
