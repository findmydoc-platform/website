import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/forms/[slug]/route'

// Mock the dependencies
vi.mock('@/utilities/getForm', () => ({
  getForm: vi.fn(),
}))

vi.mock('@/utilities/submitForm', () => ({
  submitFormData: vi.fn(),
}))

import { getForm } from '@/utilities/getForm'
import { submitFormData } from '@/utilities/submitForm'

describe('/api/forms/[slug] API route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should successfully submit clinic registration form', async () => {
    const mockForm = {
      id: '1',
      title: 'Clinic Registration Form',
      slug: 'clinic-registration',
    }

    const mockSubmissionResult = {
      id: 'submission-123',
      submissionData: [
        { field: 'clinicName', value: 'Test Clinic' },
        { field: 'email', value: 'test@clinic.com' },
      ],
    }

    vi.mocked(getForm).mockResolvedValue(mockForm)
    vi.mocked(submitFormData).mockResolvedValue(mockSubmissionResult)

    const formData = {
      clinicName: 'Test Clinic',
      email: 'test@clinic.com',
      firstName: 'John',
      lastName: 'Doe',
    }

    const request = new NextRequest('http://localhost:3000/api/forms/clinic-registration', {
      method: 'POST',
      body: JSON.stringify(formData),
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const params = { slug: 'clinic-registration' }
    const response = await POST(request, { params: Promise.resolve(params) })

    expect(response.status).toBe(200)
    const responseData = await response.json()
    
    expect(responseData).toEqual({
      success: true,
      message: 'Form submitted successfully',
      data: mockSubmissionResult,
    })

    expect(getForm).toHaveBeenCalledWith('clinic-registration')
    expect(submitFormData).toHaveBeenCalledWith({
      formId: '1',
      values: formData,
    })
  })

  it('should return 404 when form is not found', async () => {
    vi.mocked(getForm).mockResolvedValue(null)

    const request = new NextRequest('http://localhost:3000/api/forms/nonexistent', {
      method: 'POST',
      body: JSON.stringify({}),
    })

    const params = { slug: 'nonexistent' }
    const response = await POST(request, { params: Promise.resolve(params) })

    expect(response.status).toBe(404)
    const responseData = await response.json()
    expect(responseData).toEqual({ error: 'Form not found' })
  })

  it('should return 500 when form retrieval fails', async () => {
    vi.mocked(getForm).mockRejectedValue(new Error('Could not load form'))

    const request = new NextRequest('http://localhost:3000/api/forms/clinic-registration', {
      method: 'POST',
      body: JSON.stringify({}),
    })

    const params = { slug: 'clinic-registration' }
    const response = await POST(request, { params: Promise.resolve(params) })

    expect(response.status).toBe(500)
    const responseData = await response.json()
    expect(responseData).toEqual({ error: 'Could not load form' })
  })

  it('should return 500 when form submission fails', async () => {
    const mockForm = { id: '1', title: 'Test Form' }
    vi.mocked(getForm).mockResolvedValue(mockForm)
    vi.mocked(submitFormData).mockRejectedValue(new Error('Submission failed'))

    const request = new NextRequest('http://localhost:3000/api/forms/clinic-registration', {
      method: 'POST',
      body: JSON.stringify({ test: 'data' }),
    })

    const params = { slug: 'clinic-registration' }
    const response = await POST(request, { params: Promise.resolve(params) })

    expect(response.status).toBe(500)
    const responseData = await response.json()
    expect(responseData).toEqual({ error: 'Submission failed' })
  })
})