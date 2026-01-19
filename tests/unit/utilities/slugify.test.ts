/**
 * Unit tests for slugify utility
 */

import { describe, it, expect } from 'vitest'
import { slugify } from '@/utilities/slugify'

describe('slugify', () => {
  it('should convert basic strings to slugs', () => {
    expect(slugify('Hello World')).toBe('hello-world')
    expect(slugify('This is a test')).toBe('this-is-a-test')
    expect(slugify('Simple String')).toBe('simple-string')
  })

  it('should replace spaces with hyphens', () => {
    expect(slugify('one two three')).toBe('one-two-three')
    expect(slugify('multiple    spaces')).toBe('multiple----spaces')
    expect(slugify(' leading and trailing spaces ')).toBe('-leading-and-trailing-spaces-')
  })

  it('should convert to lowercase', () => {
    expect(slugify('UPPERCASE')).toBe('uppercase')
    expect(slugify('MixedCase')).toBe('mixedcase')
    expect(slugify('CamelCase')).toBe('camelcase')
  })

  it('should remove special characters', () => {
    expect(slugify('Hello@World!')).toBe('helloworld')
    expect(slugify('Test#$%^&*()')).toBe('test')
    expect(slugify('Special!@#$%^&*()Characters')).toBe('specialcharacters')
  })

  it('should preserve word characters and hyphens', () => {
    expect(slugify('preserve-hyphens')).toBe('preserve-hyphens')
    expect(slugify('keep_underscores')).toBe('keep_underscores')
    expect(slugify('numbers123')).toBe('numbers123')
    expect(slugify('mix3d_numb3rs-and_l3tt3rs')).toBe('mix3d_numb3rs-and_l3tt3rs')
  })

  it('should handle empty strings', () => {
    expect(slugify('')).toBe('')
    expect(slugify('   ')).toBe('---')
  })

  it('should handle null and undefined inputs', () => {
    expect(slugify(null as unknown as string)).toBe('')
    expect(slugify(undefined as unknown as string)).toBe('')
  })

  it('should handle strings with only special characters', () => {
    expect(slugify('!@#$%^&*()')).toBe('')
    expect(slugify('.,;:"\'[]{}()')).toBe('')
    expect(slugify('+=<>?/|`~')).toBe('')
  })

  it('should handle mixed content', () => {
    expect(slugify('Hello, World! 123')).toBe('hello-world-123')
    expect(slugify('Test & Development')).toBe('test--development')
    expect(slugify('C++ Programming')).toBe('c-programming')
  })

  it('should handle consecutive special characters', () => {
    expect(slugify('word!!!another')).toBe('wordanother')
    expect(slugify('test---multiple')).toBe('test---multiple') // Hyphens are preserved
    expect(slugify('mix@#$%test')).toBe('mixtest')
  })

  it('should handle accented characters', () => {
    // Note: This function removes non-word characters, so accented chars will be removed
    expect(slugify('café')).toBe('caf')
    expect(slugify('naïve')).toBe('nave')
    expect(slugify('résumé')).toBe('rsum')
  })

  it('should handle numbers and letters', () => {
    expect(slugify('Article 123')).toBe('article-123')
    expect(slugify('Version 2.0')).toBe('version-20')
    expect(slugify('Test123ABC')).toBe('test123abc')
  })

  it('should handle URLs and file names', () => {
    expect(slugify('my-file.txt')).toBe('my-filetxt')
    expect(slugify('https://example.com')).toBe('httpsexamplecom')
    expect(slugify('https://example.com/My Page?foo=bar')).toBe('httpsexamplecommy-pagefoobar')
    expect(slugify('https://example.com/a/b/c#Section 2')).toBe('httpsexamplecomabcsection-2')
    expect(slugify('file_name.pdf')).toBe('file_namepdf')
  })

  it('should handle long strings', () => {
    const longString = 'This is a very long string with many words and special characters!'
    expect(slugify(longString)).toBe('this-is-a-very-long-string-with-many-words-and-special-characters')
  })

  it('should handle edge cases', () => {
    expect(slugify('___')).toBe('___')
    expect(slugify('---')).toBe('---')
    expect(slugify('123')).toBe('123')
    expect(slugify('___test___')).toBe('___test___')
  })

  it('should be idempotent for already valid slugs', () => {
    const validSlug = 'already-valid-slug'
    expect(slugify(validSlug)).toBe(validSlug)

    const anotherSlug = 'another_valid_slug123'
    expect(slugify(anotherSlug)).toBe(anotherSlug)
  })

  it('should handle real-world examples', () => {
    expect(slugify('How to Learn JavaScript in 2023')).toBe('how-to-learn-javascript-in-2023')
    expect(slugify('Top 10 React Tips & Tricks')).toBe('top-10-react-tips--tricks')
    expect(slugify('Node.js vs Python: A Comparison')).toBe('nodejs-vs-python-a-comparison')
    expect(slugify('Getting Started with TypeScript')).toBe('getting-started-with-typescript')
  })
})
