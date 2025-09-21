/**
 * Unit tests for submitForm utility
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { submitFormData } from '@/utilities/submitForm'

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('submitFormData', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
    mockFetch.mockClear()
  })

  afterEach(() => {
    process.env = originalEnv
    vi.clearAllMocks()
  })

  it('should submit form data successfully', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        id: 'submission-123',
        message: 'Form submitted successfully',
      }),
    }

    mockFetch.mockResolvedValue(mockResponse)
    process.env.NEXT_PUBLIC_SERVER_URL = 'https://example.com'

    const formData = {
      formId: 'contact-form-id',
      values: {
        name: 'John Doe',
        email: 'john@example.com',
        message: 'Hello, this is a test message',
      },
    }

    const result = await submitFormData(formData)

    expect(mockFetch).toHaveBeenCalledWith('https://example.com/api/form-submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        form: 'contact-form-id',
        submissionData: [
          { field: 'name', value: 'John Doe' },
          { field: 'email', value: 'john@example.com' },
          { field: 'message', value: 'Hello, this is a test message' },
        ],
      }),
    })

    expect(result).toEqual({
      id: 'submission-123',
      message: 'Form submitted successfully',
    })
  })

  it('should transform values to string format', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true }),
    }

    mockFetch.mockResolvedValue(mockResponse)

    const formData = {
      formId: 'test-form',
      values: {
        age: 25,
        isSubscribed: true,
        score: 98.5,
        items: null,
        description: undefined,
      },
    }

    await submitFormData(formData)

    const callArgs = mockFetch.mock.calls[0]!
    const body = JSON.parse((callArgs[1] as any).body)

    expect(body.submissionData).toEqual([
      { field: 'age', value: '25' },
      { field: 'isSubscribed', value: 'true' },
      { field: 'score', value: '98.5' },
      { field: 'items', value: 'null' },
      { field: 'description', value: 'undefined' },
    ])
  })

  it('should use empty server URL when environment variable not set', async () => {
    process.env.NEXT_PUBLIC_SERVER_URL = ''

    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true }),
    }

    mockFetch.mockResolvedValue(mockResponse)

    await submitFormData({
      formId: 'test-form',
      values: { name: 'Test' },
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/form-submissions', expect.any(Object))
  })

  it('should throw error when response is not ok', async () => {
    const mockResponse = {
      ok: false,
      status: 400,
      json: vi.fn().mockResolvedValue({
        error: 'Validation failed',
      }),
    }

    mockFetch.mockResolvedValue(mockResponse)

    await expect(
      submitFormData({
        formId: 'test-form',
        values: { name: 'Test' },
      }),
    ).rejects.toThrow('Validation failed')
  })

  it('should throw generic error when response has no error details', async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      json: vi.fn().mockResolvedValue({}),
    }

    mockFetch.mockResolvedValue(mockResponse)

    await expect(
      submitFormData({
        formId: 'test-form',
        values: { name: 'Test' },
      }),
    ).rejects.toThrow('Form submission failed: 500')
  })

  it('should handle JSON parsing errors in error response', async () => {
    const mockResponse = {
      ok: false,
      status: 422,
      json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
    }

    mockFetch.mockResolvedValue(mockResponse)

    await expect(
      submitFormData({
        formId: 'test-form',
        values: { name: 'Test' },
      }),
    ).rejects.toThrow('Form submission failed: 422')
  })

  it('should handle network errors', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    await expect(
      submitFormData({
        formId: 'test-form',
        values: { name: 'Test' },
      }),
    ).rejects.toThrow('Network error')
  })

  it('should handle empty values object', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true }),
    }

    mockFetch.mockResolvedValue(mockResponse)

    await submitFormData({
      formId: 'test-form',
      values: {},
    })

    const callArgs = mockFetch.mock.calls[0]!
    const body = JSON.parse((callArgs[1] as any).body)

    expect(body.submissionData).toEqual([])
  })

  it('should handle values with special characters', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true }),
    }

    mockFetch.mockResolvedValue(mockResponse)

    const formData = {
      formId: 'test-form',
      values: {
        'field-with-dashes': 'value with spaces',
        field_with_underscores: 'value@with#special$chars',
        'unicode-field': 'café naïve résumé',
      },
    }

    await submitFormData(formData)

    const callArgs = mockFetch.mock.calls[0]!
    const body = JSON.parse((callArgs[1] as any).body)

    expect(body.submissionData).toEqual([
      { field: 'field-with-dashes', value: 'value with spaces' },
      { field: 'field_with_underscores', value: 'value@with#special$chars' },
      { field: 'unicode-field', value: 'café naïve résumé' },
    ])
  })

  it('should handle large form data', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true }),
    }

    mockFetch.mockResolvedValue(mockResponse)

    // Create a large values object
    const values: Record<string, string> = {}
    for (let i = 0; i < 100; i++) {
      values[`field_${i}`] = `value_${i}`.repeat(10) // Long values
    }

    await submitFormData({
      formId: 'large-form',
      values,
    })

    const callArgs = mockFetch.mock.calls[0]!
    const body = JSON.parse((callArgs[1] as any).body)

    expect(body.submissionData).toHaveLength(100)
    expect(body.submissionData[0]).toEqual({
      field: 'field_0',
      value: 'value_0'.repeat(10),
    })
  })

  it('should set correct request headers', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true }),
    }

    mockFetch.mockResolvedValue(mockResponse)

    await submitFormData({
      formId: 'test-form',
      values: { name: 'Test' },
    })

    const callArgs = mockFetch.mock.calls[0]!
    expect((callArgs[1] as any).method).toBe('POST')
    expect((callArgs[1] as any).headers).toEqual({
      'Content-Type': 'application/json',
    })
  })

  it('should handle different HTTP error codes', async () => {
    const testCases = [
      { status: 400, expectedMessage: 'Bad Request' },
      { status: 401, expectedMessage: 'Unauthorized' },
      { status: 403, expectedMessage: 'Forbidden' },
      { status: 404, expectedMessage: 'Not Found' },
      { status: 422, expectedMessage: 'Validation Error' },
      { status: 500, expectedMessage: 'Server Error' },
    ]

    for (const testCase of testCases) {
      mockFetch.mockClear()

      const mockResponse = {
        ok: false,
        status: testCase.status,
        json: vi.fn().mockResolvedValue({
          error: testCase.expectedMessage,
        }),
      }

      mockFetch.mockResolvedValue(mockResponse)

      await expect(
        submitFormData({
          formId: 'test-form',
          values: { name: 'Test' },
        }),
      ).rejects.toThrow(testCase.expectedMessage)
    }
  })

  it('should preserve field order in submission data', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true }),
    }

    mockFetch.mockResolvedValue(mockResponse)

    // Use an object with specific field order
    const formData = {
      formId: 'test-form',
      values: {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        age: '25',
      },
    }

    await submitFormData(formData)

    const callArgs = mockFetch.mock.calls[0]!
    const body = JSON.parse((callArgs[1] as any).body)

    // Field order should match Object.entries() order
    expect(body.submissionData.map((item: any) => item.field)).toEqual(['firstName', 'lastName', 'email', 'age'])
  })
})
