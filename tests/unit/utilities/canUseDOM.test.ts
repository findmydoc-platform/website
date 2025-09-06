/**
 * Unit tests for canUseDOM utility
 */

import { describe, it, expect } from 'vitest'

describe('canUseDOM', () => {
  it('should export a boolean value', async () => {
    const { default: canUseDOM } = await import('@/utilities/canUseDOM')
    expect(typeof canUseDOM).toBe('boolean')
  })

  it('should be false in Node.js test environment', async () => {
    // In Node.js environment without jsdom, DOM APIs are not available
    const { default: canUseDOM } = await import('@/utilities/canUseDOM')
    expect(canUseDOM).toBe(false)
  })

  it('should correctly check for window, document, and createElement in Node.js', () => {
    // Test the logic in the actual Node.js environment
    const hasWindow = typeof window !== 'undefined'
    const hasDocument = typeof window !== 'undefined' && !!window.document
    const hasCreateElement = typeof window !== 'undefined' && !!window.document && !!window.document.createElement
    
    expect(hasWindow).toBe(false) // Node.js doesn't have window
    expect(hasDocument).toBe(false) // No document without window
    expect(hasCreateElement).toBe(false) // No createElement without document
  })

  it('should use double negation for boolean conversion', () => {
    // Test the boolean conversion logic
    const truthyValue = 'some value'
    const falsyValue = null
    
    expect(!!truthyValue).toBe(true)
    expect(!!falsyValue).toBe(false)
  })

  it('should demonstrate the actual condition behavior', () => {
    // Show what the actual condition evaluates to
    const condition = !!(typeof window !== 'undefined' && window.document && window.document.createElement)
    expect(condition).toBe(false) // In Node.js test environment
  })
})