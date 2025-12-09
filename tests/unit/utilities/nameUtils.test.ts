/**
 * Unit tests for nameUtils utility
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest'
import { capitalizeFirstLetter, generateFullName } from '@/utilities/nameUtils'

describe('nameUtils', () => {
  describe('capitalizeFirstLetter', () => {
    it('should capitalize first letter of lowercase string', () => {
      expect(capitalizeFirstLetter('hello')).toBe('Hello')
      expect(capitalizeFirstLetter('world')).toBe('World')
      expect(capitalizeFirstLetter('test')).toBe('Test')
    })

    it('should handle already capitalized strings', () => {
      expect(capitalizeFirstLetter('Hello')).toBe('Hello')
      expect(capitalizeFirstLetter('WORLD')).toBe('WORLD')
      expect(capitalizeFirstLetter('Test')).toBe('Test')
    })

    it('should handle single character strings', () => {
      expect(capitalizeFirstLetter('a')).toBe('A')
      expect(capitalizeFirstLetter('Z')).toBe('Z')
      expect(capitalizeFirstLetter('1')).toBe('1')
      expect(capitalizeFirstLetter('!')).toBe('!')
    })

    it('should handle empty string', () => {
      expect(capitalizeFirstLetter('')).toBe('')
    })

    it('should handle null input', () => {
      expect(capitalizeFirstLetter(null)).toBe('')
    })

    it('should handle undefined input', () => {
      expect(capitalizeFirstLetter(undefined)).toBe('')
    })

    it('should handle non-string input', () => {
      expect(capitalizeFirstLetter(123 as any)).toBe('')
      expect(capitalizeFirstLetter(true as any)).toBe('')
      expect(capitalizeFirstLetter([] as any)).toBe('')
      expect(capitalizeFirstLetter({} as any)).toBe('')
    })

    it('should handle strings with numbers and special characters', () => {
      expect(capitalizeFirstLetter('123abc')).toBe('123abc')
      expect(capitalizeFirstLetter('!hello')).toBe('!hello')
      expect(capitalizeFirstLetter(' hello')).toBe(' hello') // Leading space
    })

    it('should handle strings with accented characters', () => {
      expect(capitalizeFirstLetter('josé')).toBe('José')
      expect(capitalizeFirstLetter('andré')).toBe('André')
      expect(capitalizeFirstLetter('françois')).toBe('François')
    })
  })

  describe('generateFullName', () => {
    it('should combine title, first name, and last name', () => {
      expect(generateFullName('dr', 'john', 'doe')).toBe('Dr John Doe')
      expect(generateFullName('ms', 'jane', 'smith')).toBe('Ms Jane Smith')
      expect(generateFullName('prof', 'alice', 'johnson')).toBe('Prof Alice Johnson')
    })

    it('should handle case variations', () => {
      expect(generateFullName('DR', 'JOHN', 'DOE')).toBe('DR JOHN DOE')
      expect(generateFullName('dr', 'john', 'doe')).toBe('Dr John Doe')
      expect(generateFullName('Dr', 'John', 'Doe')).toBe('Dr John Doe')
    })

    it('should work without title', () => {
      expect(generateFullName(null, 'john', 'doe')).toBe('John Doe')
      expect(generateFullName(undefined, 'jane', 'smith')).toBe('Jane Smith')
      expect(generateFullName('', 'alice', 'johnson')).toBe('Alice Johnson')
    })

    it('should work with only first name', () => {
      expect(generateFullName('dr', 'john', null)).toBe('Dr John')
      expect(generateFullName('dr', 'john', undefined)).toBe('Dr John')
      expect(generateFullName('dr', 'john', '')).toBe('Dr John')
    })

    it('should work with only last name', () => {
      // When firstName is null/undefined, capitalizeFirstLetter returns '',
      // so we get extra spaces that trim handles
      expect(generateFullName('dr', null, 'doe')).toBe('Dr  Doe')
      expect(generateFullName('dr', undefined, 'smith')).toBe('Dr  Smith') 
      expect(generateFullName('dr', '', 'johnson')).toBe('Dr  Johnson') // Empty string also returns '', so same behavior
    })

    it('should handle all null/undefined values', () => {
      expect(generateFullName(null, null, null)).toBe('')
      expect(generateFullName(undefined, undefined, undefined)).toBe('')
      expect(generateFullName('', '', '')).toBe('')
    })

    it('should trim extra whitespace at the end', () => {
      // The function trims the final result, so leading/trailing spaces are removed
      expect(generateFullName('', 'john', 'doe')).toBe('John Doe') // Empty title gets trimmed
      expect(generateFullName('dr', '', 'doe')).toBe('Dr  Doe') // Empty firstName leaves double space
      expect(generateFullName('dr', 'john', '')).toBe('Dr John') // Empty lastName gets trimmed
    })

    it('should handle names with spaces and special characters', () => {
      expect(generateFullName('dr', 'jean-luc', 'picard')).toBe('Dr Jean-luc Picard')
      expect(generateFullName('ms', 'mary jane', 'watson')).toBe('Ms Mary jane Watson')
      expect(generateFullName('prof', 'josé', 'garcía')).toBe('Prof José García')
    })

    it('should handle various title formats', () => {
      expect(generateFullName('mr.', 'john', 'doe')).toBe('Mr. John Doe')
      expect(generateFullName('PhD', 'jane', 'smith')).toBe('PhD Jane Smith') // Only capitalizes first letter
      expect(generateFullName('II', 'john', 'doe')).toBe('II John Doe')
    })

    it('should handle edge cases with mixed null and valid values', () => {
      expect(generateFullName('dr', null, 'doe')).toBe('Dr  Doe')
      expect(generateFullName(null, 'john', null)).toBe('John') // Spaces get trimmed
      expect(generateFullName(null, null, 'doe')).toBe('Doe') // Leading spaces get trimmed
    })

    it('should capitalize only the first letter of each component', () => {
      // Test that each component is capitalized separately
      expect(generateFullName('dr', 'john', 'doe')).toBe('Dr John Doe')
      expect(generateFullName('ms', 'jane', 'smith')).toBe('Ms Jane Smith')
      
      // Only first letter gets capitalized, rest stays as-is
      expect(generateFullName('dR', 'jOhN', 'dOe')).toBe('DR JOhN DOe')
    })
  })
})
