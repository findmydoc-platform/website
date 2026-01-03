import type { Transition, Variants } from 'motion/react'

export const revealTransition: Transition = {
  duration: 0.3,
  ease: 'easeOut',
}

export const createRevealVariants = (prefersReducedMotion: boolean): Variants => ({
  hidden: {
    opacity: 0,
    x: prefersReducedMotion ? 0 : 16,
    y: prefersReducedMotion ? 0 : 4,
  },
  visible: {
    opacity: 1,
    x: 0,
    y: 0,
  },
})
