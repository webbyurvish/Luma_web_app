import { NavLink } from 'react-router-dom'
import { ChevronsLeft, ChevronsRight, X } from 'lucide-react'
import { Logo, LogoMark } from './Logo'
import { bottomNavItems, navGroups, type NavItem } from './navConfig'
import { useSidebar } from '@/context/SidebarContext'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/cn'

function NavRow({ item, collapsed, onClick }: { item: NavItem; collapsed: boolean; onClick?: () => void }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-2.5 rounded-xs py-1.5 pointer-coarse:py-3 text-[13px] pointer-coarse:text-sm transition-colors duration-150',
          collapsed ? 'justify-center px-0' : 'pl-3.5 pr-2',
          isActive ? 'text-paper' : 'text-paper/55 hover:bg-paper/[0.06] hover:text-paper/85',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              'absolute left-0 top-1/2 h-4 w-[2.5px] -translate-y-1/2 bg-rust transition-opacity duration-150',
              isActive ? 'opacity-100' : 'opacity-0',
            )}
            aria-hidden="true"
          />
          <Icon size={15.5} strokeWidth={1.8} className="shrink-0" />
          {!collapsed && <span className="truncate">{item.label}</span>}
          {collapsed && (
            <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-sm bg-ink-rail px-2 py-1 text-[11px] text-paper opacity-0 shadow-hover transition-opacity duration-150 group-hover:opacity-100 z-50">
              {item.label}
            </span>
          )}
        </>
      )}
    </NavLink>
  )
}

export function Sidebar() {
  const { collapsed, toggleCollapsed, mobileOpen, closeMobile } = useSidebar()

  return (
    <>
      <aside
        className={cn(
          'sticky top-0 z-30 hidden h-dvh shrink-0 flex-col bg-ink-rail py-5 transition-[width] duration-200 md:flex',
          collapsed ? 'w-[72px] px-0' : 'w-[224px]',
        )}
      >
        <div className={cn('mb-6', collapsed ? 'flex justify-center' : 'px-5')}>
          <Logo collapsed={collapsed} inverted />
        </div>

        <nav className="flex flex-1 flex-col gap-5">
          {navGroups.map((group) => (
            <div key={group.label}>
              {!collapsed && (
                <p className="mb-1.5 px-3.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-paper/35">{group.label}</p>
              )}
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => (
                  <NavRow key={item.to} item={item} collapsed={collapsed} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className={cn('mt-4 flex flex-col gap-3 border-t border-paper/10 pt-4', collapsed ? 'items-center px-0' : 'px-3.5')}>
          {!collapsed && (
            <div className="flex items-center gap-2.5 px-0.5">
              <Avatar name="Urvish Krina" size={28} inverted />
              <div className="min-w-0 leading-tight">
                <p className="truncate text-xs font-medium text-paper">Urvish Krina</p>
                <p className="truncate text-[10px] text-paper/45">Personal account</p>
              </div>
            </div>
          )}
          <div className="flex flex-col gap-0.5">
            {bottomNavItems.map((item) => (
              <NavRow key={item.to} item={item} collapsed={collapsed} />
            ))}
          </div>
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn(
              'flex items-center gap-2.5 py-1.5 text-[11px] text-paper/40 transition-colors hover:text-paper/70',
              collapsed ? 'justify-center' : 'pl-3.5',
            )}
          >
            {collapsed ? <ChevronsRight size={14} /> : <ChevronsLeft size={14} />}
            {!collapsed && <span className="uppercase tracking-[0.08em]">Collapse</span>}
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <button type="button" aria-label="Close navigation" className="absolute inset-0 bg-ink/40" onClick={closeMobile} />
          <div className="relative z-10 flex h-full w-[240px] flex-col bg-ink-rail py-5 shadow-hover animate-fade-up">
            <div className="mb-6 flex items-center justify-between px-5">
              <div className="flex items-center gap-2.5">
                <LogoMark size={28} inverted />
                <div className="leading-tight">
                  <p className="font-display text-[15px] italic text-paper">Luma</p>
                  <p className="text-[10px] uppercase tracking-[0.12em] text-paper/50">Personal OS</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeMobile}
                aria-label="Close navigation"
                className="rounded-sm p-1.5 text-paper/50 hover:bg-paper/10 hover:text-paper"
              >
                <X size={16} />
              </button>
            </div>
            <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-0">
              {navGroups.map((group) => (
                <div key={group.label}>
                  <p className="mb-1.5 px-3.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-paper/35">{group.label}</p>
                  <div className="flex flex-col gap-0.5">
                    {group.items.map((item) => (
                      <NavRow key={item.to} item={item} collapsed={false} onClick={closeMobile} />
                    ))}
                  </div>
                </div>
              ))}
            </nav>
            <div className="mt-4 flex flex-col gap-0.5 border-t border-paper/10 px-3.5 pt-4">
              {bottomNavItems.map((item) => (
                <NavRow key={item.to} item={item} collapsed={false} onClick={closeMobile} />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
