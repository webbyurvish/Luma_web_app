/**
 * The family document structure: who → what kind of document → which account.
 * Pure data → a nested folder spec the script builds in one go (existing folders are reused).
 */

export interface FolderSpec {
  name: string
  children?: FolderSpec[]
}

export type PersonRole = 'self' | 'spouse' | 'parent' | 'child' | 'sibling' | 'other'

export type CategoryKey =
  | 'identity'
  | 'banking'
  | 'cards'
  | 'investments'
  | 'insurance'
  | 'loans'
  | 'tax'
  | 'work'
  | 'property'
  | 'vehicles'
  | 'health'
  | 'education'
  | 'legal'
  | 'government'
  | 'purchases'
  | 'business'

export interface AccountRef {
  id: string
  /** e.g. "HDFC Savings", "ICICI Coral" */
  label: string
  last4: string
}

export interface PersonConfig {
  id: string
  name: string
  role: PersonRole
  categories: CategoryKey[]
  banks: AccountRef[]
  cards: AccountRef[]
}

export interface FamilyConfig {
  people: PersonConfig[]
  inbox: boolean
  shared: boolean
  joint: AccountRef[]
  emergency: boolean
  archive: boolean
}

/** Financial year folder for today, e.g. "FY 2026-27" (Indian FY: April–March). */
export function currentFy(date = new Date()): string {
  const start = date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1
  return `FY ${start}-${String((start + 1) % 100).padStart(2, '0')}`
}

export const ROLE_LABELS: Record<PersonRole, string> = {
  self: 'Me',
  spouse: 'Spouse',
  parent: 'Parent',
  child: 'Child',
  sibling: 'Sibling',
  other: 'Other',
}

export interface CategoryDef {
  key: CategoryKey
  folder: string
  label: string
  hint: string
  sub?: (role: PersonRole) => string[]
}

export const CATEGORIES: CategoryDef[] = [
  { key: 'identity', folder: '01 Identity & Certificates', label: 'Identity', hint: 'Aadhaar, PAN, passport, birth/marriage certificates' },
  { key: 'banking', folder: '02 Banking', label: 'Banking', hint: 'One folder per bank account' },
  { key: 'cards', folder: '03 Cards', label: 'Cards', hint: 'One folder per credit card' },
  {
    key: 'investments',
    folder: '04 Investments',
    label: 'Investments',
    hint: 'MF, stocks, EPF/PPF/NPS, small savings, gold',
    sub: (role) =>
      role === 'child'
        ? ['Sukanya Samriddhi & Small Savings', 'Mutual Funds']
        : ['Mutual Funds', 'Stocks & Demat', 'Retirement (EPF, PPF, NPS)', 'Small Savings (NSC, KVP, SCSS, SSY)', 'Gold & Bonds', 'Other'],
  },
  { key: 'insurance', folder: '05 Insurance', label: 'Insurance', hint: 'Health, life, vehicle, claims', sub: () => ['Health', 'Life & Term', 'Vehicle', 'Home', 'Travel', 'Claims'] },
  { key: 'loans', folder: '06 Loans & Credit', label: 'Loans', hint: 'Loan papers, CIBIL, money lent', sub: () => ['Credit Reports', 'Money Lent or Borrowed'] },
  { key: 'tax', folder: '07 Tax', label: 'Tax', hint: 'By financial year: Form 16, AIS, ITR, proofs' },
  { key: 'work', folder: '08 Work & Income', label: 'Work', hint: 'Offer letters, payslips, PF', sub: () => ['Employment', 'Payslips', 'PF & Gratuity'] },
  { key: 'property', folder: '09 Property', label: 'Property', hint: 'Deeds, property tax, rent', sub: () => ['Rent Agreements & Receipts'] },
  { key: 'vehicles', folder: '10 Vehicles', label: 'Vehicles', hint: 'RC, insurance, PUC, service' },
  {
    key: 'health',
    folder: '11 Health & Medical',
    label: 'Health',
    hint: 'Reports, prescriptions, hospital stays',
    sub: (role) => ['Reports', 'Prescriptions', 'Hospital Stays', role === 'child' ? 'Vaccinations' : 'Vaccinations & Records'],
  },
  { key: 'education', folder: '12 Education', label: 'Education', hint: 'Marksheets, degrees, school papers', sub: (role) => (role === 'child' ? ['School & Fee Receipts', 'Certificates'] : []) },
  { key: 'legal', folder: '13 Legal & Estate', label: 'Legal', hint: 'Will, nominations, POA, agreements' },
  {
    key: 'government',
    folder: '14 Government & Benefits',
    label: 'Government',
    hint: 'Pension, life certificate, scheme cards',
    sub: (role) => (role === 'parent' ? ['Pension & Life Certificate', 'Senior Citizen & Health Schemes'] : []),
  },
  { key: 'purchases', folder: '15 Purchases & Warranties', label: 'Warranties', hint: 'Invoices, warranty cards, manuals' },
  { key: 'business', folder: '16 Business & Freelance', label: 'Business', hint: 'GST, invoices, contracts', sub: () => ['GST & Registrations', 'Invoices', 'Contracts'] },
]

export const ROLE_DEFAULTS: Record<PersonRole, CategoryKey[]> = {
  self: ['identity', 'banking', 'cards', 'investments', 'insurance', 'loans', 'tax', 'work', 'property', 'vehicles', 'health', 'education', 'legal', 'purchases'],
  spouse: ['identity', 'banking', 'cards', 'investments', 'insurance', 'tax', 'work', 'health', 'education', 'legal'],
  parent: ['identity', 'banking', 'investments', 'insurance', 'tax', 'property', 'health', 'legal', 'government'],
  child: ['identity', 'banking', 'investments', 'health', 'education'],
  sibling: ['identity', 'banking', 'cards', 'investments', 'insurance', 'tax', 'work', 'health', 'education'],
  other: ['identity', 'banking', 'health'],
}

const BANK_SUBFOLDERS = ['KYC & Nomination', 'Cheques & Mandates', 'FD & RD', 'Tax Certificates (Interest, 16A, 15G-15H)', 'Locker', 'Letters & Disputes']

export function accountFolderName(ref: AccountRef): string {
  const label = ref.label.trim() || 'Account'
  const last4 = ref.last4.replace(/\D/g, '').slice(-4)
  return last4 ? `${label} ••${last4}` : label
}

function bankAccountFolder(ref: AccountRef, fy: string): FolderSpec {
  return { name: accountFolderName(ref), children: [{ name: 'Statements', children: [{ name: fy }] }, ...BANK_SUBFOLDERS.map((name) => ({ name }))] }
}

function cardFolder(ref: AccountRef, fy: string): FolderSpec {
  return { name: accountFolderName(ref), children: [{ name: 'Statements', children: [{ name: fy }] }, { name: 'Agreement & Letters' }] }
}

function personFolder(person: PersonConfig, index: number, fy: string): FolderSpec {
  const children: FolderSpec[] = CATEGORIES.filter((c) => person.categories.includes(c.key)).map((cat) => {
    let kids: FolderSpec[] = (cat.sub?.(person.role) ?? []).map((name) => ({ name }))
    if (cat.key === 'banking') kids = person.banks.filter((b) => b.label.trim()).map((b) => bankAccountFolder(b, fy))
    if (cat.key === 'cards') kids = person.cards.filter((c) => c.label.trim()).map((c) => cardFolder(c, fy))
    if (cat.key === 'tax')
      kids = [{ name: fy, children: ['Income Proofs (Form 16, 26AS, AIS)', 'Deductions (80C, 80D, HRA)', 'Capital Gains', 'Filing (ITR & Acknowledgement)', 'Notices & Refunds'].map((name) => ({ name })) }]
    if (cat.key === 'work') kids = kids.map((k) => (k.name === 'Payslips' ? { name: 'Payslips', children: [{ name: fy }] } : k))
    return kids.length ? { name: cat.folder, children: kids } : { name: cat.folder }
  })
  return { name: `${(index + 1) * 10} ${person.name.trim() || ROLE_LABELS[person.role]}`, children }
}

export function buildFamilyTree(config: FamilyConfig, now = new Date()): FolderSpec[] {
  const fy = currentFy(now)
  const tree: FolderSpec[] = []
  if (config.inbox) tree.push({ name: '00 Inbox (to sort)' })
  if (config.shared)
    tree.push({
      name: '01 Family (Shared)',
      children: [
        { name: 'Joint Accounts', children: config.joint.filter((j) => j.label.trim()).map((j) => bankAccountFolder(j, fy)) },
        { name: 'Home' },
        { name: 'Utilities (Electricity, Gas, Internet, Mobile)' },
        { name: 'Family Insurance' },
        { name: 'Travel' },
        { name: 'Household Staff' },
      ].map((f) => (f.children && !f.children.length ? { name: f.name } : f)),
    })
  if (config.emergency) tree.push({ name: '02 Emergency Kit' })
  config.people.forEach((p, i) => tree.push(personFolder(p, i, fy)))
  if (config.archive) tree.push({ name: '99 Archive' })
  return tree
}

export function countFolders(tree: FolderSpec[]): number {
  return tree.reduce((sum, f) => sum + 1 + countFolders(f.children ?? []), 0)
}

export function newPerson(role: PersonRole, name = ''): PersonConfig {
  return { id: crypto.randomUUID(), name, role, categories: [...ROLE_DEFAULTS[role]], banks: [], cards: [] }
}

export function newAccountRef(label = '', last4 = ''): AccountRef {
  return { id: crypto.randomUUID(), label, last4 }
}
