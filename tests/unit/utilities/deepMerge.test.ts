/**
 * Unit tests for deepMerge utility
 */

import { describe, it, expect } from 'vitest'
import deepMerge, { isObject } from '@/utilities/deepMerge'

describe('deepMerge', () => {
  describe('isObject helper', () => {
    it('should return true for plain objects', () => {
      expect(isObject({})).toBe(true)
      expect(isObject({ key: 'value' })).toBe(true)
      expect(isObject({ nested: { key: 'value' } })).toBe(true)
    })

    it('should return false for non-objects', () => {
      expect(isObject(null)).toBe(false)
      expect(isObject(undefined)).toBe(false)
      expect(isObject('string')).toBe(false)
      expect(isObject(123)).toBe(false)
      expect(isObject(true)).toBe(false)
      expect(isObject([])).toBe(false)
      expect(isObject([1, 2, 3])).toBe(false)
      // Note: new Date() actually returns true because it's an object type
      expect(isObject(new Date())).toBe(true)
    })
  })

  describe('deepMerge function', () => {
    it('should merge simple objects', () => {
      const target = { a: 1, b: 2 }
      const source = { b: 3, c: 4 }
      const result = deepMerge(target, source)

      expect(result).toEqual({ a: 1, b: 3, c: 4 })
      expect(result).not.toBe(target) // Should create new object
    })

    it('should handle nested objects', () => {
      const target = {
        user: { name: 'John', age: 30 },
        settings: { theme: 'dark' },
      }
      const source = {
        user: { age: 31, email: 'john@example.com' },
        newKey: 'value',
      }
      const result = deepMerge(target, source)

      expect(result).toEqual({
        user: { name: 'John', age: 31, email: 'john@example.com' },
        settings: { theme: 'dark' },
        newKey: 'value',
      })
    })

    it('should handle deeply nested objects', () => {
      const target = {
        level1: {
          level2: {
            level3: { value: 'original' },
          },
        },
      }
      const source = {
        level1: {
          level2: {
            level3: { value: 'updated', newValue: 'added' },
          },
        },
      }
      const result = deepMerge(target, source)

      expect(result).toEqual({
        level1: {
          level2: {
            level3: { value: 'updated', newValue: 'added' },
          },
        },
      })
    })

    it('should handle empty objects', () => {
      expect(deepMerge({}, {})).toEqual({})
      expect(deepMerge({ a: 1 }, {})).toEqual({ a: 1 })
      expect(deepMerge({}, { b: 2 })).toEqual({ b: 2 })
    })

    it('should handle spreading string values when merging objects', () => {
      const target = { config: { existing: 'value' } }
      const source = { config: 'simple' }
      const result = deepMerge(target, source)

      // When source value is primitive, it overwrites target object
      expect(result).toEqual({ config: 'simple' })
    })

    it('should handle arrays as primitive values (not merge them)', () => {
      const target = { items: [1, 2, 3] }
      const source = { items: [4, 5] }
      const result = deepMerge(target, source)

      expect(result).toEqual({ items: [4, 5] })
    })

    it('should preserve original objects immutability', () => {
      const target = { a: { b: 1 } }
      const source = { a: { c: 2 } }
      const result = deepMerge(target, source)

      // Original objects should not be modified
      expect(target).toEqual({ a: { b: 1 } })
      expect(source).toEqual({ a: { c: 2 } })

      // Result should contain merged data
      expect(result).toEqual({ a: { b: 1, c: 2 } })
    })
  })
})
