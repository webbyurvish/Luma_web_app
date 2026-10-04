import { CalendarRange, CarFront, FileText, HandCoins, HeartPulse, Home, ListChecks, LockKeyhole, NotebookText, Users, Settings, Sparkles, Wallet, type LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const navGroups: NavGroup[] = [
  {
    label: 'Main',
    items: [
      { to: '/', label: 'Home', icon: Home },
      { to: '/assistant', label: 'Assistant', icon: Sparkles },
    ],
  },
  {
    label: 'Money',
    items: [
      { to: '/finance', label: 'Finance', icon: Wallet },
      { to: '/review', label: 'Monthly review', icon: CalendarRange },
      { to: '/udhaar', label: 'Udhaar', icon: HandCoins },
    ],
  },
  {
    label: 'Life',
    items: [
      { to: '/tasks', label: 'Tasks', icon: ListChecks },
      { to: '/notes', label: 'Notes', icon: NotebookText },
      { to: '/family', label: 'Family', icon: Users },
      { to: '/vehicles', label: 'Vehicles', icon: CarFront },
      { to: '/health', label: 'Health', icon: HeartPulse },
    ],
  },
  {
    label: 'Library',
    items: [
      { to: '/documents', label: 'Documents', icon: FileText },
      { to: '/vault', label: 'Vault', icon: LockKeyhole },
    ],
  },
]

export const bottomNavItems: NavItem[] = [{ to: '/settings', label: 'Settings', icon: Settings }]
