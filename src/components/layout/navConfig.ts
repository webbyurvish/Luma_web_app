import { FileText, HandCoins, Home, ListChecks, NotebookText, Settings, Sparkles, Wallet, type LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

export const mainNavItems: NavItem[] = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/assistant', label: 'Assistant', icon: Sparkles },
  { to: '/finance', label: 'Finance', icon: Wallet },
  { to: '/udhaar', label: 'Udhaar', icon: HandCoins },
  { to: '/tasks', label: 'Tasks', icon: ListChecks },
  { to: '/documents', label: 'Documents', icon: FileText },
  { to: '/notes', label: 'Notes', icon: NotebookText },
]

export const bottomNavItems: NavItem[] = [{ to: '/settings', label: 'Settings', icon: Settings }]
