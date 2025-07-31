import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getForm } from '@/utilities/getForm'

// Mock the payload config and getPayload
vi.mock('@payload-config', () => ({
  default: {
    /* mock config */
  },
}))

vi.mock('payload', () => ({
  getPayload: vi.fn(),
}))

import { getPayload } from 'payload'

describe('getForm utility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

    const mockPayload = {
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      find: vi.fn().mockResolvedValue({
        docs: [mockForm],
      }),
    }

    vi.mocked(getPayload).mockResolvedValue(mockPayload as any)

    const result = await getForm('clinic-registration')

    expect(mockPayload.find).toHaveBeenCalledWith({
      collection: 'forms',
      where: {
        slug: {
          equals: 'clinic-registration',
        },
      },
      limit: 1,
      depth: 1,
    })
    expect(result).toEqual(mockForm)
    expect(mockPayload.logger.info).toHaveBeenCalledWith('Attempting to fetch form with slug: clinic-registration')
    expect(mockPayload.logger.info).toHaveBeenCalledWith('Successfully retrieved form: Clinic Registration Form (ID: 1)')
  })

  it('should return null when form is not found', async () => {
    const mockPayload = {
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      find: vi.fn().mockResolvedValue({
        docs: [],
      }),
    }

    vi.mocked(getPayload).mockResolvedValue(mockPayload as any)

    const result = await getForm('nonexistent-form')

    expect(result).toBeNull()
    expect(mockPayload.logger.warn).toHaveBeenCalledWith('Form not found with slug: nonexistent-form')
  })

  it('should throw user-friendly error when payload fails to initialize', async () => {
    vi.mocked(getPayload).mockRejectedValue(new Error('Database connection failed'))

    await expect(getForm('clinic-registration')).rejects.toThrow('Unable to retrieve form. Please ensure the form exists and try again.')
  })

  it('should throw user-friendly error when payload find fails', async () => {
    const mockPayload = {
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      find: vi.fn().mockRejectedValue(new Error('Database query failed')),
    }

    vi.mocked(getPayload).mockResolvedValue(mockPayload as any)

    await expect(getForm('clinic-registration')).rejects.toThrow('Unable to retrieve form. Please ensure the form exists and try again.')
    expect(mockPayload.logger.error).toHaveBeenCalledWith('Failed to fetch form with slug clinic-registration:', {
      error: 'Database query failed',
      slug: 'clinic-registration',
      stack: expect.any(String),
    })
  })
})