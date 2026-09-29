import type { Transition, Variants } from 'framer-motion'

export const easeOut: Transition = { duration: 0.26, ease: [0.16, 1, 0.3, 1] }
export const easeSnappy: Transition = { duration: 0.16, ease: [0.16, 1, 0.3, 1] }

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { ...easeOut, delay: Math.min(i, 6) * 0.035 },
  }),
}

export const cardHover = {
  rest: { y: 0, boxShadow: 'var(--shadow-card)' },
  hover: { y: -2, boxShadow: 'var(--shadow-hover)', transition: easeSnappy },
}

export const tileHover = {
  rest: { y: 0 },
  hover: { y: -1, transition: easeSnappy },
  tap: { scale: 0.98, transition: { duration: 0.1 } },
}

export const pageTransition: Variants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: easeOut },
  exit: { opacity: 0, y: -4, transition: { duration: 0.12 } },
}

export const modalTransition: Variants = {
  hidden: { opacity: 0, scale: 0.97, y: 4 },
  visible: { opacity: 1, scale: 1, y: 0, transition: easeSnappy },
  exit: { opacity: 0, scale: 0.98, transition: { duration: 0.12 } },
}

export const tabContent: Variants = {
  hidden: { opacity: 0, y: 4 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] } },
}

export const slideOverTransition: Variants = {
  hidden: { opacity: 0, x: 24 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.24, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, x: 16, transition: { duration: 0.16 } },
}
