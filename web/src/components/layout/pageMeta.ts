export interface PageMeta {
  title: string
  subtitle: string
}

export const pageMeta: Record<string, PageMeta> = {
  '/': { title: 'Dashboard', subtitle: "Your personal overview" },
  '/assistant': { title: 'Assistant', subtitle: 'Your finances, documents and tasks — all in one place' },
  '/finance': { title: 'Finance', subtitle: 'Income, expenses and where your money goes' },
  '/transactions': { title: 'Transactions', subtitle: 'Every payment, all in one place' },
  '/udhaar': { title: 'Udhaar', subtitle: 'Track what you have given and what you owe' },
  '/tasks': { title: 'Tasks', subtitle: 'Stay on top of what matters today' },
  '/documents': { title: 'Documents', subtitle: 'Keep every important file organized' },
  '/notes': { title: 'Notes', subtitle: 'Everything you want to remember' },
  '/family': { title: 'Family', subtitle: 'Dates, recharges and form details for everyone' },
  '/review': { title: 'Monthly review', subtitle: 'Where the money went, and what changed' },
  '/vehicles': { title: 'Vehicles', subtitle: 'Papers, service and running cost' },
  '/health': { title: 'Health', subtitle: 'Medical bills and insurance claims for the family' },
  '/tools': { title: 'File tools', subtitle: 'Convert, merge, split and shrink files — privately' },
  '/vault': { title: 'Vault', subtitle: 'Passwords, cards, bank details and IDs — encrypted on your device' },
  '/settings': { title: 'Settings', subtitle: 'Manage your profile and preferences' },
}

export function getPageMeta(pathname: string): PageMeta {
  return pageMeta[pathname] ?? { title: 'Luma', subtitle: 'Personal OS' }
}
