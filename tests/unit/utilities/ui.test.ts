/**
 * Unit tests for ui utility (cn function)
 */

import { describe, it, expect } from 'vitest'
import { cn } from '@/utilities/ui'

describe('ui utilities', () => {
  describe('cn function', () => {
    it('should merge simple class names', () => {
      expect(cn('btn', 'primary')).toBe('btn primary')
      expect(cn('text-lg', 'font-bold')).toBe('text-lg font-bold')
    })

    it('should handle conditional classes with clsx', () => {
      expect(cn('btn', true && 'active')).toBe('btn active')
      expect(cn('btn', false && 'active')).toBe('btn')
    })

    it('should handle object-style conditional classes', () => {
      expect(
        cn({
          btn: true,
          active: true,
          disabled: false,
        }),
      ).toBe('btn active')
    })

    it('should merge Tailwind classes and resolve conflicts', () => {
      // tailwind-merge should handle conflicting classes
      expect(cn('p-4', 'p-2')).toBe('p-2') // Later class wins
      expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
    })

    it('should handle arrays of classes', () => {
      expect(cn(['btn', 'primary'], 'large')).toBe('btn primary large')
      expect(cn(['text-lg', 'font-bold'], ['text-center'])).toBe('text-lg font-bold text-center')
    })

    it('should handle empty and falsy values', () => {
      expect(cn()).toBe('')
      expect(cn('')).toBe('')
      expect(cn(null)).toBe('')
      expect(cn(undefined)).toBe('')
      expect(cn(false)).toBe('')
      expect(cn(0)).toBe('')
    })

    it('should handle mixed input types', () => {
      expect(cn('btn', { active: true, disabled: false }, ['primary', 'large'], 'custom-class')).toBe(
        'btn active primary large custom-class',
      )
    })

    it('should merge conflicting Tailwind utilities correctly', () => {
      // Test tailwind-merge functionality
      expect(cn('px-4', 'px-2')).toBe('px-2')
      expect(cn('py-4', 'py-2')).toBe('py-2')
      // Note: The actual behavior may be different - test what actually happens
      expect(cn('m-4', 'mx-2')).toBe('m-4 mx-2') // Later class wins by position
    })

    it('should handle responsive and variant classes', () => {
      expect(cn('md:p-4', 'lg:p-6')).toBe('md:p-4 lg:p-6')
      expect(cn('hover:bg-blue-500', 'focus:bg-blue-600')).toBe('hover:bg-blue-500 focus:bg-blue-600')
    })

    it('should handle Tailwind modifier conflicts', () => {
      expect(cn('text-sm', 'text-lg')).toBe('text-lg')
      expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500')
      expect(cn('border-2', 'border-4')).toBe('border-4')
    })

    it('should preserve non-conflicting classes', () => {
      expect(cn('flex', 'items-center', 'justify-between')).toBe('flex items-center justify-between')
      expect(cn('w-full', 'h-screen', 'bg-gray-100')).toBe('w-full h-screen bg-gray-100')
    })

    it('should handle complex real-world scenarios', () => {
      // Button component example
      const buttonClasses = cn(
        'inline-flex items-center justify-center',
        'px-4 py-2',
        'border border-transparent',
        'rounded-md text-sm font-medium',
        'focus:outline-hidden focus:ring-2 focus:ring-offset-2',
        { 'bg-blue-600 text-white': true },
        { 'opacity-50 cursor-not-allowed': false },
      )
      expect(buttonClasses).toContain('inline-flex')
      expect(buttonClasses).toContain('bg-blue-600')
      expect(buttonClasses).not.toContain('opacity-50')
    })

    it('should handle card component example', () => {
      const cardClasses = cn(
        'bg-white',
        'rounded-lg',
        'shadow-md',
        'p-6',
        { 'border border-gray-200': true },
        { 'shadow-lg': false },
      )
      expect(cardClasses).toBe('bg-white rounded-lg shadow-md p-6 border border-gray-200')
    })

    it('should handle input component with states', () => {
      const inputClasses = cn(
        'block w-full px-3 py-2',
        'rounded-md border',
        'focus:outline-hidden focus:ring-2 focus:ring-blue-500',
        {
          'border-red-500 focus:ring-red-500': false, // error state
          'border-gray-300': true, // normal state
        },
      )
      expect(inputClasses).toContain('border-gray-300')
      expect(inputClasses).not.toContain('border-red-500')
    })

    it('should maintain proper order with conflicts', () => {
      // Later classes should override earlier ones
      expect(cn('text-black', 'text-white')).toBe('text-white')
      expect(cn('p-0', 'p-4', 'p-8')).toBe('p-8')
    })

    it('should handle whitespace correctly', () => {
      expect(cn('  btn  ', '  primary  ')).toBe('btn primary')
      expect(cn('btn\n\tprimary')).toBe('btn primary')
    })
  })
})
