import { AnimatePresence, motion } from 'framer-motion'
import { useLocation, useOutlet } from 'react-router-dom'
import { pageTransition } from '@/lib/motion'
import { PageErrorBoundary } from './PageErrorBoundary'

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
        <PageErrorBoundary key={location.pathname}>{outlet}</PageErrorBoundary>
      </motion.div>
    </AnimatePresence>
  )
}
