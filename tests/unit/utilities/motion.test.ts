import { describe, it, expect } from 'vitest'
import { createRevealVariants, revealTransition } from '@/utilities/motion'

describe('motion utilities', () => {
  describe('revealTransition', () => {
    it('should have the correct duration and easing', () => {
      expect(revealTransition).toEqual({
        duration: 0.3,
        ease: 'easeOut',
      })
    })
  })

  describe('createRevealVariants', () => {
    it('should return variants with motion when prefersReducedMotion is false', () => {
      const variants = createRevealVariants(false)

      expect(variants.hidden).toEqual({
        opacity: 0,
        x: 16,
        y: 4,
      })

      expect(variants.visible).toEqual({
        opacity: 1,
        x: 0,
        y: 0,
      })
    })

    it('should return variants without motion when prefersReducedMotion is true', () => {
      const variants = createRevealVariants(true)

      expect(variants.hidden).toEqual({
        opacity: 0,
        x: 0,
        y: 0,
      })

      expect(variants.visible).toEqual({
        opacity: 1,
        x: 0,
        y: 0,
      })
    })
  })
})
