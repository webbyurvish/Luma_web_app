import { lazy, Suspense, useEffect, useState } from 'react'

/** Opens Snap & file from anywhere (the header camera button and the command palette dispatch this). */
const OPEN_SNAP_EVENT = 'luma:open-snap'
export const openSnap = () => window.dispatchEvent(new Event(OPEN_SNAP_EVENT))

// The sheet is fetched the first time it opens, not at startup.
const SnapSheet = lazy(() => import('./SnapSheet'))

export function SnapHost() {
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const show = () => {
      setLoaded(true)
      setOpen(true)
    }
    window.addEventListener(OPEN_SNAP_EVENT, show)
    return () => window.removeEventListener(OPEN_SNAP_EVENT, show)
  }, [])

  if (!loaded) return null
  return (
    <Suspense fallback={null}>
      <SnapSheet open={open} onClose={() => setOpen(false)} />
    </Suspense>
  )
}
