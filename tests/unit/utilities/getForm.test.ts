/**
 * Unit tests for getForm utility
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getForm } from '@/utilities/getForm'

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('getForm', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
    mockFetch.mockClear()
  })

  afterEach(() => {
    process.env = originalEnv
    vi.clearAllMocks()
  })

  it('should fetch form by slug successfully', async () => {
    const mockForm = {
      id: 'form-123',
      slug: 'contact-us',
      title: 'Contact Form',
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'email', type: 'email', required: true }
      ]
    }

    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        docs: [mockForm]
      })
    }

    mockFetch.mockResolvedValue(mockResponse)
    process.env.NEXT_PUBLIC_SERVER_URL = 'https://example.com'

    const result = await getForm('contact-us')

    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/api/forms?where[slug][equals]=contact-us'
    )
    expect(result).toEqual(mockForm)
  })

  it('should use empty server URL when environment variable not set', async () => {
    delete process.env.NEXT_PUBLIC_SERVER_URL

    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        docs: [{ id: 'form-123' }]
      })
    }

    mockFetch.mockResolvedValue(mockResponse)

    await getForm('test-form')

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/forms?where[slug][equals]=test-form'
    )
  })

  it('should throw error when response is not ok', async () => {
    const mockResponse = {
      ok: false,
      status: 404,
      statusText: 'Not Found'
    }

    mockFetch.mockResolvedValue(mockResponse)

    await expect(getForm('non-existent-form')).rejects.toThrow('Could not load form')
  })

  it('should throw error when no forms found', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        docs: [] // Empty array means no forms found
      })
    }

    mockFetch.mockResolvedValue(mockResponse)

    await expect(getForm('missing-form')).rejects.toThrow('Form not found')
  })

  it('should handle network errors', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    await expect(getForm('any-form')).rejects.toThrow('Network error')
  })

  it('should handle malformed JSON response', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockRejectedValue(new Error('Invalid JSON'))
    }

    mockFetch.mockResolvedValue(mockResponse)

    await expect(getForm('test-form')).rejects.toThrow('Invalid JSON')
  })

  it('should handle response without docs property', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        // Missing docs property - this will cause an error when accessing docs.length
        message: 'Success'
      })
    }

    mockFetch.mockResolvedValue(mockResponse)

    // The function will try to access docs.length and throw a different error
    await expect(getForm('test-form')).rejects.toThrow()
  })

  it('should return first form when multiple forms found', async () => {
    const forms = [
      { id: 'form-1', slug: 'contact', title: 'Contact Form 1' },
      { id: 'form-2', slug: 'contact', title: 'Contact Form 2' }
    ]

    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        docs: forms
      })
    }

    mockFetch.mockResolvedValue(mockResponse)

    const result = await getForm('contact')

    expect(result).toEqual(forms[0])
  })

  it('should handle slugs with special characters', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        docs: [{ id: 'form-123', slug: 'contact-us-2023!' }]
      })
    }

    mockFetch.mockResolvedValue(mockResponse)
    process.env.NEXT_PUBLIC_SERVER_URL = 'https://example.com'

    await getForm('contact-us-2023!')

    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/api/forms?where[slug][equals]=contact-us-2023!'
    )
  })

  it('should handle empty slug', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        docs: [{ id: 'form-123', slug: '' }]
      })
    }

    mockFetch.mockResolvedValue(mockResponse)

    await getForm('')

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('where[slug][equals]=')
    )
  })

  it('should construct correct API URL with server URL', async () => {
    const testCases = [
      { serverUrl: 'https://api.example.com', expected: 'https://api.example.com/api/forms' },
      { serverUrl: 'http://localhost:3000', expected: 'http://localhost:3000/api/forms' },
      { serverUrl: 'https://my-app.vercel.app', expected: 'https://my-app.vercel.app/api/forms' }
    ]

    for (const testCase of testCases) {
      mockFetch.mockClear()
      process.env.NEXT_PUBLIC_SERVER_URL = testCase.serverUrl

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          docs: [{ id: 'form-123' }]
        })
      }

      mockFetch.mockResolvedValue(mockResponse)

      await getForm('test')

      expect(mockFetch).toHaveBeenCalledWith(
        `${testCase.expected}?where[slug][equals]=test`
      )
    }
  })

  it('should handle 500 server errors', async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    }

    mockFetch.mockResolvedValue(mockResponse)

    await expect(getForm('test-form')).rejects.toThrow('Could not load form')
  })

  it('should handle timeout errors', async () => {
    mockFetch.mockImplementation(() => 
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 100)
      })
    )

    await expect(getForm('test-form')).rejects.toThrow('Request timeout')
  })
})