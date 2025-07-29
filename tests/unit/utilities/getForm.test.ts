import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getForm } from '@/utilities/getForm'

// Mock fetch globally
global.fetch = vi.fn()

describe('getForm utility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SERVER_URL = 'http://localhost:3000'
  })

  it('should successfully fetch a form by slug', async () => {
    const mockForm = {
      id: 1,
      title: 'Clinic Registration Form',
      slug: 'clinic-registration',
      fields: [
        { name: 'clinicName', type: 'text', required: true },
        { name: 'email', type: 'email', required: true },
      ],
    }

    const mockResponse = {
      docs: [mockForm],
    }

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const result = await getForm('clinic-registration')

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/forms?where[slug][equals]=clinic-registration'
    )
    expect(result).toEqual(mockForm)
  })

  it('should throw error when API request fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 400,
    } as Response)

    await expect(getForm('clinic-registration')).rejects.toThrow('Could not load form')
  })

  it('should throw error when form is not found', async () => {
    const mockResponse = {
      docs: [],
    }

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    await expect(getForm('clinic-registration')).rejects.toThrow('Form not found')
  })

  it('should construct correct API URL without server URL', async () => {
    const originalUrl = process.env.NEXT_PUBLIC_SERVER_URL
    process.env.NEXT_PUBLIC_SERVER_URL = ''

    const mockResponse = {
      docs: [{ id: 1, title: 'Test Form' }],
    }

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    await getForm('test-form')

    expect(fetch).toHaveBeenCalledWith('/api/forms?where[slug][equals]=test-form')
    
    // Restore original value
    if (originalUrl !== undefined) {
      process.env.NEXT_PUBLIC_SERVER_URL = originalUrl
    }
  })
})