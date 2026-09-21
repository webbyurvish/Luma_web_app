import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Bell, Menu, Search } from 'lucide-react'
import { getPageMeta } from './pageMeta'
import { useSidebar } from '@/context/SidebarContext'
import { Avatar } from '@/components/ui/Avatar'
import { Input } from '@/components/ui/Input'

export function Header() {
  const location = useLocation()
  const { openMobile } = useSidebar()
  const [hasNotifications] = useState(true)
  const meta = getPageMeta(location.pathname)

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-border bg-bg/85 px-4 py-4 backdrop-blur-sm sm:px-6 md:py-5">
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={openMobile}
          aria-label="Open navigation"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-btn border border-border bg-card text-ink-soft md:hidden"
        >
          <Menu size={18} />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-ink sm:text-[26px]">{meta.title}</h1>
          <p className="truncate text-xs text-ink-soft sm:text-sm">{meta.subtitle}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2.5 sm:gap-3">
        <div className="hidden w-56 lg:block xl:w-72">
          <Input icon={<Search size={16} />} placeholder="Search..." aria-label="Search" />
        </div>
        <button
          aria-label="Notifications"
          className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-btn border border-border bg-card text-ink-soft transition-colors hover:text-ink"
        >
          <Bell size={18} />
          {hasNotifications && (
            <span className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-danger" aria-hidden="true" />
          )}
        </button>
        <Avatar name="Urvish Krina" size={38} className="hidden sm:flex" />
      </div>
    </header>
  )
}
