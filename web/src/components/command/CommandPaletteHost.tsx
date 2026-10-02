import { lazy, Suspense, useEffect, useState } from 'react'

/** Opens the palette from anywhere (the header's search buttons dispatch this). */
const OPEN_PALETTE_EVENT = 'luma:open-palette'
export const openCommandPalette = () => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT))

// The palette (search, quick-add forms) is fetched the first time it opens, not at startup.
const PaletteLayer = lazy(() => import('./CommandPalette'))

/** Always mounted: just the shortcuts (⌘K / Ctrl+K, "/") and the open event. */
export function CommandPaletteHost() {
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const show = () => {
      setLoaded(true)
      setOpen(true)
    }
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const typing = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setLoaded(true)
        setOpen((o) => !o)
      } else if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        show()
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener(OPEN_PALETTE_EVENT, show)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener(OPEN_PALETTE_EVENT, show)
    }
  }, [])

  if (!loaded) return null
  return (
    <Suspense fallback={null}>
      <PaletteLayer open={open} onClose={() => setOpen(false)} />
    </Suspense>
  )
}
