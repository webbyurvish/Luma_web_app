import { Suspense } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useLocation, useOutlet } from 'react-router-dom'
import { pageTransition } from '@/lib/motion'
import { PageErrorBoundary } from './PageErrorBoundary'
import { LedgerLoader } from '@/components/ui/Loader'

export function PageTransition() {
  const location = useLocation()
  const outlet = useOutlet()

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        variants={pageTransition}
        initial="initial"
        animate="animate"
        exit="exit"
      >
        {/* keyed by route, so moving to another page clears a previous page error */}
        <PageErrorBoundary key={location.pathname}>
          {/* Pages load on demand; this shows only the first time one is opened on a slow connection. */}
          <Suspense fallback={<LedgerLoader label="Opening…" className="min-h-[50vh] justify-center" />}>{outlet}</Suspense>
        </PageErrorBoundary>
      </motion.div>
    </AnimatePresence>
  )
}
