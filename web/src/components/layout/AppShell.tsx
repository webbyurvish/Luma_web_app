import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { PageTransition } from './PageTransition'
import { SidebarProvider } from '@/context/SidebarContext'
import { ToastProvider } from '@/context/ToastContext'
import { CommandPaletteHost } from '@/components/command/CommandPaletteHost'
import { SnapHost } from '@/components/snap/SnapHost'

export function AppShell() {
  return (
    <SidebarProvider>
      <ToastProvider>
        <div className="flex min-h-dvh w-full">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <Header />
            <main className="min-w-0 flex-1 px-4 pb-8 sm:px-7">
              <PageTransition />
            </main>
          </div>
        </div>
        <CommandPaletteHost />
        <SnapHost />
      </ToastProvider>
    </SidebarProvider>
  )
}
