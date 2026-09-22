import type { Note } from '@/types'

export interface NoteCategoryDef {
  id: string
  name: string
}

export const NOTE_CATEGORIES: NoteCategoryDef[] = [
  { id: 'finance', name: 'Finance' },
  { id: 'personal', name: 'Personal' },
  { id: 'contacts', name: 'Contacts' },
  { id: 'home', name: 'Home' },
]

export const mockNotes: Note[] = [
  {
    id: 'nt-001',
    title: 'Car Information',
    content:
      'Registration number: MH12 AB 4521\nInsurance renewal: 18 Sept 2026 (HDFC Ergo)\nService center: Trident Hyundai, Baner\nLast service: 12 Jul 2026, next due at 45,000 km',
    category: 'personal',
    tags: ['car', 'insurance'],
    createdAt: '2026-06-02',
    updatedAt: '2026-09-14',
  },
  {
    id: 'nt-002',
    title: 'Investment Notes',
    content:
      'SIP allocations:\n- Parag Parikh Flexi Cap — ₹8,000/mo\n- Mirae Asset Large Cap — ₹5,000/mo\n- Nifty 50 Index — ₹4,000/mo\n\nYearly review scheduled every April. Rebalance if any fund drifts more than 5% from target allocation.',
    category: 'finance',
    tags: ['sip', 'mutual-funds'],
    createdAt: '2026-04-01',
    updatedAt: '2026-09-10',
  },
  {
    id: 'nt-003',
    title: 'Home Information',
    content:
      'Society maintenance contact: Ramesh (Secretary) — 98xxxxxx21\nWi-Fi: Luma_5G, password in password manager\nAppliance warranties:\n- Fridge (LG) — till Mar 2028\n- Washing machine (Bosch) — till Nov 2027',
    category: 'home',
    tags: ['home', 'warranty'],
    createdAt: '2026-03-15',
    updatedAt: '2026-09-05',
  },
  {
    id: 'nt-004',
    title: 'Important Contacts',
    content:
      'Family doctor: Dr. Nair — 90xxxxxx10\nElectrician: Suresh — 98xxxxxx44\nPlumber: Iqbal — 97xxxxxx88\nSociety office: 020-xxxxxxx',
    category: 'contacts',
    tags: ['emergency'],
    createdAt: '2026-02-20',
    updatedAt: '2026-08-29',
  },
  {
    id: 'nt-005',
    title: 'Tax Filing Checklist',
    content:
      'Documents needed for this financial year:\n- Form 16 from employer\n- Investment proofs (80C, 80D)\n- Rent receipts for HRA\n- Home loan interest certificate\n- Capital gains statement from broker',
    category: 'finance',
    tags: ['tax', 'checklist'],
    createdAt: '2026-01-05',
    updatedAt: '2026-08-20',
  },
  {
    id: 'nt-006',
    title: 'Travel Wishlist',
    content:
      'Places to visit next year:\n- Ladakh (Jun–Jul, before monsoon closes passes)\n- Kerala backwaters (Oct–Feb)\n- Japan cherry blossoms (Mar–Apr)\n\nRough budget: keep a separate travel fund, target ₹1.5L/year.',
    category: 'personal',
    tags: ['travel'],
    createdAt: '2026-01-02',
    updatedAt: '2026-08-11',
  },
]
