import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/utilities/getForm', () => ({
  getForm: vi.fn(),
}))

vi.mock('@/utilities/logging/serverLogger', () => ({
  getServerLogger: vi.fn().mockResolvedValue({
    debug: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    info: vi.fn(),
    level: 'info',
    trace: vi.fn(),
    warn: vi.fn(),
  }),
}))

vi.mock('@/utilities/submitForm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utilities/submitForm')>()

  return {
    ...actual,
    submitFormData: vi.fn(),
  }
})

import { POST } from '@/app/api/form-bridge/[slug]/route'
import { getForm } from '@/utilities/getForm'
import { FormSubmissionError, submitFormData } from '@/utilities/submitForm'

const mockedGetForm = vi.mocked(getForm)
const mockedSubmitFormData = vi.mocked(submitFormData)

const makeRequest = (body: unknown) =>
  new NextRequest('http://localhost/api/form-bridge/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

describe('POST /api/form-bridge/[slug]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 for invalid request payload', async () => {
    const response = await POST(makeRequest(['invalid']), { params: Promise.resolve({ slug: 'contact' }) })
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toBe('Invalid request payload')
    expect(mockedGetForm).not.toHaveBeenCalled()
  })

  it('returns 404 when the form does not exist', async () => {
    mockedGetForm.mockResolvedValueOnce(null)

    const response = await POST(makeRequest({ name: 'Jane' }), { params: Promise.resolve({ slug: 'missing' }) })
    const json = await response.json()

    expect(response.status).toBe(404)
    expect(json.error).toBe('Form not found')
  })

  it('returns the upstream form submission status instead of 500', async () => {
    mockedGetForm.mockResolvedValueOnce({ id: 'form-123' } as unknown as Awaited<ReturnType<typeof getForm>>)
    mockedSubmitFormData.mockRejectedValueOnce(new FormSubmissionError('Validation failed', 422))

    const response = await POST(makeRequest({ email: 'invalid' }), { params: Promise.resolve({ slug: 'contact' }) })
    const json = await response.json()

    expect(response.status).toBe(422)
    expect(json.error).toBe('Validation failed')
  })

  it('returns 200 when submission succeeds', async () => {
    mockedGetForm.mockResolvedValueOnce({ id: 'form-123' } as unknown as Awaited<ReturnType<typeof getForm>>)
    mockedSubmitFormData.mockResolvedValueOnce({ id: 'submission-1' })

    const response = await POST(makeRequest({ email: 'jane@example.com' }), {
      params: Promise.resolve({ slug: 'contact' }),
    })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual({
      success: true,
      message: 'Form submitted successfully',
      data: { id: 'submission-1' },
    })
  })
})
