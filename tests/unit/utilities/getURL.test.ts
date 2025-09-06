/**
 * Unit tests for getURL utilities
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getServerSideURL, getClientSideURL } from '@/utilities/getURL'

describe('getURL utilities', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
  })

  afterEach(() => {
    process.env = originalEnv
    vi.unstubAllGlobals()
  })

  describe('getServerSideURL', () => {
    it('should return NEXT_PUBLIC_SERVER_URL when set', () => {
      process.env.NEXT_PUBLIC_SERVER_URL = 'https://my-app.com'
      expect(getServerSideURL()).toBe('https://my-app.com')
    })

    it('should return Vercel production URL when NEXT_PUBLIC_SERVER_URL is not set', () => {
      delete process.env.NEXT_PUBLIC_SERVER_URL
      process.env.VERCEL_PROJECT_PRODUCTION_URL = 'my-vercel-app.vercel.app'
      expect(getServerSideURL()).toBe('https://my-vercel-app.vercel.app')
    })

    it('should return localhost fallback when no environment variables are set', () => {
      delete process.env.NEXT_PUBLIC_SERVER_URL
      delete process.env.VERCEL_PROJECT_PRODUCTION_URL
      expect(getServerSideURL()).toBe('http://localhost:3000')
    })

    it('should prioritize NEXT_PUBLIC_SERVER_URL over Vercel URL', () => {
      process.env.NEXT_PUBLIC_SERVER_URL = 'https://custom-domain.com'
      process.env.VERCEL_PROJECT_PRODUCTION_URL = 'my-vercel-app.vercel.app'
      expect(getServerSideURL()).toBe('https://custom-domain.com')
    })

    it('should handle empty NEXT_PUBLIC_SERVER_URL', () => {
      process.env.NEXT_PUBLIC_SERVER_URL = ''
      process.env.VERCEL_PROJECT_PRODUCTION_URL = 'my-vercel-app.vercel.app'
      expect(getServerSideURL()).toBe('https://my-vercel-app.vercel.app')
    })

    it('should handle Vercel URL without protocol', () => {
      delete process.env.NEXT_PUBLIC_SERVER_URL
      process.env.VERCEL_PROJECT_PRODUCTION_URL = 'example.vercel.app'
      expect(getServerSideURL()).toBe('https://example.vercel.app')
    })
  })

  describe('getClientSideURL', () => {
    it('should return fallback to Vercel URL when not in browser environment', () => {
      // In Node.js test environment, canUseDOM is false, so it uses fallbacks
      process.env.VERCEL_PROJECT_PRODUCTION_URL = 'my-app.vercel.app'
      expect(getClientSideURL()).toBe('https://my-app.vercel.app')
    })

    it('should fallback to NEXT_PUBLIC_SERVER_URL when no Vercel URL', () => {
      delete process.env.VERCEL_PROJECT_PRODUCTION_URL
      process.env.NEXT_PUBLIC_SERVER_URL = 'https://custom-app.com'
      expect(getClientSideURL()).toBe('https://custom-app.com')
    })

    it('should return empty string when no fallbacks available', () => {
      delete process.env.VERCEL_PROJECT_PRODUCTION_URL
      delete process.env.NEXT_PUBLIC_SERVER_URL
      expect(getClientSideURL()).toBe('')
    })

    it('should handle environment without DOM (Node.js)', () => {
      // Test the actual Node.js behavior
      delete process.env.VERCEL_PROJECT_PRODUCTION_URL
      delete process.env.NEXT_PUBLIC_SERVER_URL
      
      const result = getClientSideURL()
      expect(result).toBe('') // Should return empty string in Node.js environment
    })

    it('should handle environment variables correctly', () => {
      // Test priority order in Node.js environment
      process.env.VERCEL_PROJECT_PRODUCTION_URL = 'vercel-app.vercel.app'
      process.env.NEXT_PUBLIC_SERVER_URL = 'https://custom-domain.com'
      
      const result = getClientSideURL()
      expect(result).toBe('https://vercel-app.vercel.app') // Vercel URL has priority in fallback
    })

    it('should construct Vercel URL correctly', () => {
      delete process.env.NEXT_PUBLIC_SERVER_URL
      process.env.VERCEL_PROJECT_PRODUCTION_URL = 'my-project.vercel.app'
      
      expect(getClientSideURL()).toBe('https://my-project.vercel.app')
    })

    it('should handle empty environment variables', () => {
      process.env.VERCEL_PROJECT_PRODUCTION_URL = ''
      process.env.NEXT_PUBLIC_SERVER_URL = 'https://fallback.com'
      
      expect(getClientSideURL()).toBe('https://fallback.com')
    })

    // Note: Browser environment tests would require a different test setup
    // since canUseDOM is evaluated at import time
  })

  describe('environment integration', () => {
    it('should work consistently between server and client in production', () => {
      const productionURL = 'https://my-production-app.com'
      process.env.NEXT_PUBLIC_SERVER_URL = productionURL
      
      const serverURL = getServerSideURL()
      
      // In Node.js test environment, getClientSideURL uses fallback logic
      const clientURL = getClientSideURL()
      
      expect(serverURL).toBe(productionURL)
      expect(clientURL).toBe(productionURL) // Falls back to NEXT_PUBLIC_SERVER_URL
    })

    it('should handle Vercel deployment scenario', () => {
      delete process.env.NEXT_PUBLIC_SERVER_URL
      process.env.VERCEL_PROJECT_PRODUCTION_URL = 'my-app.vercel.app'
      
      const serverURL = getServerSideURL()
      expect(serverURL).toBe('https://my-app.vercel.app')
      
      // Client-side in Node.js test environment
      const clientURL = getClientSideURL()
      expect(clientURL).toBe('https://my-app.vercel.app')
    })
  })
})