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
    <header className="flex items-center justify-between gap-4 border-b border-border px-4 py-4 sm:px-7 md:py-5">
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={openMobile}
          aria-label="Open navigation"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-border text-ink-soft md:hidden"
        >
          <Menu size={16} />
        </button>
        <div className="min-w-0">
          <h1 className="truncate font-display text-[22px] italic leading-none text-ink sm:text-[26px]">{meta.title}</h1>
          <p className="mt-1 truncate text-[11px] uppercase tracking-[0.08em] text-ink-muted">{meta.subtitle}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <button
          aria-label="Search"
          className="hidden items-center gap-2 rounded-sm border border-border bg-surface px-3 py-1.5 text-[11px] text-ink-muted transition-colors hover:border-ink-soft lg:flex lg:w-52 xl:w-64"
        >
          <Search size={13} className="shrink-0" />
          <span className="flex-1 text-left">Search</span>
          <kbd className="shrink-0 rounded-xs border border-border px-1 py-0.5 font-mono-figure text-[9px] text-ink-muted">⌘K</kbd>
        </button>
        <button
          aria-label="Notifications"
          className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-border text-ink-soft transition-colors hover:border-ink-soft hover:text-ink"
        >
          <Bell size={15} />
          {hasNotifications && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-rust" aria-hidden="true" />}
        </button>
        <Avatar name="Urvish Krina" size={32} className="hidden sm:flex" />
      </div>
    </header>
  )
}
