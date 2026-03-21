import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getForm } from '@/utilities/getForm'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('getForm', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
    process.env.NEXT_PUBLIC_SERVER_URL = ''
    process.env.VERCEL_PROJECT_PRODUCTION_URL = ''
    mockFetch.mockReset()
  })

  afterEach(() => {
    process.env = originalEnv
    vi.clearAllMocks()
  })

  it('fetches form by slug successfully', async () => {
    process.env.NEXT_PUBLIC_SERVER_URL = 'https://example.com'
    const form = { id: 1, title: 'Holding Contact', slug: 'holding-contact' }

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ docs: [form] }),
    })

    const result = await getForm('holding-contact')

    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/api/forms?where[slug][equals]=holding-contact&limit=1&depth=0',
    )
    expect(result).toEqual(form)
  })

  it('uses localhost fallback when NEXT_PUBLIC_SERVER_URL is empty', async () => {
    process.env.NEXT_PUBLIC_SERVER_URL = ''

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ docs: [{ id: 1, title: 'Holding Contact', slug: 'holding-contact' }] }),
    })

    await getForm('holding-contact')

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/forms?where[slug][equals]=holding-contact&limit=1&depth=0',
    )
  })

  it('uses Vercel production URL fallback when NEXT_PUBLIC_SERVER_URL is empty', async () => {
    process.env.NEXT_PUBLIC_SERVER_URL = ''
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'portal.vercel.app'

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ docs: [{ id: 1, title: 'Holding Contact', slug: 'holding-contact' }] }),
    })

    await getForm('holding-contact')

    expect(mockFetch).toHaveBeenCalledWith(
      'https://portal.vercel.app/api/forms?where[slug][equals]=holding-contact&limit=1&depth=0',
    )
  })

  it('encodes special characters in slug', async () => {
    process.env.NEXT_PUBLIC_SERVER_URL = ''

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ docs: [{ id: 1, title: 'Holding Contact', slug: 'holding contact' }] }),
    })

    await getForm('holding contact')

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/forms?where[slug][equals]=holding%20contact&limit=1&depth=0',
    )
  })

  it('returns null when no form exists for slug', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ docs: [] }),
    })

    await expect(getForm('missing-form')).resolves.toBeNull()
  })

  it('returns null for empty slug', async () => {
    await expect(getForm('   ')).resolves.toBeNull()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('throws on non-ok responses', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
    })

    await expect(getForm('holding-contact')).rejects.toThrow('Could not load form')
  })

  it('throws network errors', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    await expect(getForm('holding-contact')).rejects.toThrow('Network error')
  })
})
