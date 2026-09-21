import type { Transition, Variants } from 'framer-motion'

export const easeOut: Transition = { duration: 0.42, ease: [0.16, 1, 0.3, 1] }
export const easeSnappy: Transition = { duration: 0.2, ease: [0.16, 1, 0.3, 1] }

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { ...easeOut, delay: Math.min(i, 6) * 0.05 },
  }),
}

export const cardHover = {
  rest: { y: 0, boxShadow: 'var(--shadow-card)' },
  hover: { y: -3, boxShadow: 'var(--shadow-hover)', transition: easeSnappy },
}

export const tileHover = {
  rest: { y: 0, scale: 1 },
  hover: { y: -2, scale: 1.015, transition: easeSnappy },
  tap: { scale: 0.97, transition: { duration: 0.1 } },
}

export const pageTransition: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: easeOut },
  exit: { opacity: 0, y: -6, transition: { duration: 0.15 } },
}

export const modalTransition: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: 6 },
  visible: { opacity: 1, scale: 1, y: 0, transition: easeSnappy },
  exit: { opacity: 0, scale: 0.97, transition: { duration: 0.15 } },
}
