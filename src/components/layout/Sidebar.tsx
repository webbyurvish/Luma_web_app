import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronsLeft, ChevronsRight, X } from 'lucide-react'
import { Logo, LogoMark } from './Logo'
import { bottomNavItems, mainNavItems, type NavItem } from './navConfig'
import { useSidebar } from '@/context/SidebarContext'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/cn'

function NavRow({
  item,
  collapsed,
  onClick,
  scope = 'desktop',
}: {
  item: NavItem
  collapsed: boolean
  onClick?: () => void
  scope?: 'desktop' | 'mobile'
}) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      onClick={onClick}
      className={cn(
        'group relative flex items-center gap-3 rounded-btn py-2.5 text-sm font-medium transition-colors duration-200',
        collapsed ? 'justify-center px-0' : 'pl-3 pr-3',
      )}
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId={`sidebar-active-capsule-${scope}`}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              className="absolute inset-0 rounded-btn bg-gold-light shadow-xs"
              style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6), 0 1px 2px rgba(28,36,48,0.04)' }}
            />
          )}
          {isActive && !collapsed && (
            <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-gold-dark" aria-hidden="true" />
          )}
          <motion.span
            whileHover={{ x: collapsed ? 0 : 2 }}
            transition={{ duration: 0.18 }}
            className={cn(
              'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors duration-200',
              isActive ? 'text-gold-dark' : 'text-ink-soft group-hover:text-ink',
            )}
          >
            <Icon size={19} strokeWidth={isActive ? 2.3 : 1.9} />
          </motion.span>
          {!collapsed && (
            <span className={cn('relative z-10 truncate transition-colors duration-200', isActive ? 'text-ink' : 'text-ink-soft group-hover:text-ink')}>
              {item.label}
            </span>
          )}
          {collapsed && (
            <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-md bg-ink px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-hover transition-opacity duration-150 group-hover:opacity-100 z-50">
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
          'sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border-soft bg-surface py-5 transition-[width] duration-200 md:flex',
          collapsed ? 'w-[84px] px-3' : 'w-[264px] px-4',
        )}
      >
        <div className={cn('mb-7 flex items-center', collapsed ? 'justify-center' : 'justify-between')}>
          <Logo collapsed={collapsed} />
        </div>

        <nav className="flex flex-1 flex-col gap-1" aria-label="Primary">
          {mainNavItems.map((item) => (
            <NavRow key={item.to} item={item} collapsed={collapsed} />
          ))}
        </nav>

        <div className="mt-4 flex flex-col gap-3 border-t border-border-soft pt-4">
          {!collapsed && (
            <div className="flex items-center gap-2.5 rounded-btn px-1 py-1">
              <div className="relative shrink-0">
                <Avatar name="Urvish Krina" size={34} />
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-success" aria-hidden="true" />
              </div>
              <div className="min-w-0 leading-tight">
                <p className="truncate text-xs font-semibold text-ink">Urvish Krina</p>
                <p className="truncate text-[11px] text-ink-soft">Personal account</p>
              </div>
            </div>
          )}
          {bottomNavItems.map((item) => (
            <NavRow key={item.to} item={item} collapsed={collapsed} />
          ))}
          <button
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn(
              'flex items-center gap-3 rounded-btn px-3 py-2 text-xs font-medium text-ink-muted transition-colors hover:bg-bg-soft hover:text-ink',
              collapsed && 'justify-center px-0',
            )}
          >
            {collapsed ? <ChevronsRight size={17} /> : <ChevronsLeft size={17} />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <button aria-label="Close navigation" className="absolute inset-0 bg-ink/40" onClick={closeMobile} />
          <div className="relative z-10 flex h-full w-[270px] flex-col bg-surface px-4 py-5 shadow-hover animate-fade-up">
            <div className="mb-7 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <LogoMark size={32} />
                <div className="leading-tight">
                  <p className="text-[15px] font-bold tracking-tight text-ink">Luma</p>
                  <p className="text-[11px] text-ink-soft">Personal OS</p>
                </div>
              </div>
              <button
                onClick={closeMobile}
                aria-label="Close navigation"
                className="rounded-full p-1.5 text-ink-muted hover:bg-bg-soft hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>
            <nav className="flex flex-1 flex-col gap-1" aria-label="Primary">
              {mainNavItems.map((item) => (
                <NavRow key={item.to} item={item} collapsed={false} onClick={closeMobile} scope="mobile" />
              ))}
            </nav>
            <div className="mt-4 flex flex-col gap-1 border-t border-border-soft pt-4">
              {bottomNavItems.map((item) => (
                <NavRow key={item.to} item={item} collapsed={false} onClick={closeMobile} scope="mobile" />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
