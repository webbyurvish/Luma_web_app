import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Bell, Menu, Search } from 'lucide-react'
import { getPageMeta } from './pageMeta'
import { useSidebar } from '@/context/SidebarContext'
import { Avatar } from '@/components/ui/Avatar'

export function Header() {
  const location = useLocation()
  const { openMobile } = useSidebar()
  const [hasNotifications] = useState(true)
  const meta = getPageMeta(location.pathname)

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-border-soft bg-bg/80 px-4 py-4 backdrop-blur-md sm:px-6 md:py-5">
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={openMobile}
          aria-label="Open navigation"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-btn border border-border bg-card text-ink-soft md:hidden"
        >
          <Menu size={18} />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold tracking-tight text-ink sm:text-[26px]">{meta.title}</h1>
          <p className="truncate text-xs text-ink-soft sm:text-sm">{meta.subtitle}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2.5 sm:gap-3">
        <div className="hidden lg:block">
          <button
            aria-label="Search"
            className="glass-surface flex w-56 items-center gap-2.5 rounded-pill px-3.5 py-2 text-left text-xs text-ink-muted shadow-xs transition-shadow hover:shadow-card xl:w-72"
          >
            <Search size={15} className="shrink-0" />
            <span className="flex-1">Search...</span>
            <kbd className="shrink-0 rounded-md border border-border bg-card/70 px-1.5 py-0.5 font-sans text-[10px] font-medium text-ink-muted">
              ⌘K
            </kbd>
          </button>
        </div>
        <button
          aria-label="Notifications"
          className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-btn border border-border bg-card text-ink-soft transition-all duration-200 hover:-translate-y-0.5 hover:text-ink hover:shadow-card"
        >
          <Bell size={18} />
          {hasNotifications && (
            <span className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-danger ring-2 ring-card" aria-hidden="true" />
          )}
        </button>
        <Avatar name="Urvish Krina" size={38} className="hidden sm:flex" />
      </div>
    </header>
  )
}
