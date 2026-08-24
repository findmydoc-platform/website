import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const routeMocks = vi.hoisted(() => ({
  controller: vi.fn(() => null),
  getPayload: vi.fn(),
  headers: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('not-found')
  }),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`)
  }),
  resolveAuth: vi.fn(),
}))

vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('next/headers', () => ({ headers: routeMocks.headers }))
vi.mock('next/navigation', () => ({ notFound: routeMocks.notFound, redirect: routeMocks.redirect }))
vi.mock('payload', async (importOriginal) => ({
  ...(await importOriginal<typeof import('payload')>()),
  getPayload: routeMocks.getPayload,
}))
vi.mock('@/features/favorites/server', () => ({ resolveFavoriteClinicAuthContext: routeMocks.resolveAuth }))
vi.mock('@/features/patientInquiries/PatientInquiriesController.client', () => ({
  PatientInquiriesController: routeMocks.controller,
}))

describe('patient inquiries routes', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    routeMocks.getPayload.mockResolvedValue({})
    routeMocks.headers.mockResolvedValue(new Headers())
    routeMocks.resolveAuth.mockResolvedValue({ isPatient: true, patient: { id: 'patient-synthetic' } })
  })

  it('redirects an unauthenticated index request to the exact patient return target', async () => {
    routeMocks.resolveAuth.mockResolvedValue({ isPatient: false, patient: null })
    const page = await import('@/app/(frontend)/patient/inquiries/page')

    await expect(page.default()).rejects.toThrow('redirect:/login/patient?next=%2Fpatient%2Finquiries')
  })

  it('renders the authenticated index through the client controller without private server data', async () => {
    const page = await import('@/app/(frontend)/patient/inquiries/page')
    const result = (await page.default()) as React.ReactElement

    expect(result.type).toBe(routeMocks.controller)
    expect(result.props).toMatchObject({
      loginHref: '/login/patient?next=%2Fpatient%2Finquiries',
      mode: 'index',
    })
    expect(result.props).not.toHaveProperty('patientId')
    expect(result.props).not.toHaveProperty('initialData')
  })

  it('preserves the opaque inquiry id in the authenticated detail and login paths', async () => {
    const page = await import('@/app/(frontend)/patient/inquiries/[inquiryId]/page')
    const result = (await page.default({
      params: Promise.resolve({ inquiryId: 'inquiry_opaque-1' }),
    })) as React.ReactElement

    expect(result.type).toBe(routeMocks.controller)
    expect(result.props).toMatchObject({
      initialInquiryId: 'inquiry_opaque-1',
      loginHref: '/login/patient?next=%2Fpatient%2Finquiries%2Finquiry_opaque-1',
      mode: 'detail',
    })
  })

  it('rejects an overlong route id before auth or service work', async () => {
    const page = await import('@/app/(frontend)/patient/inquiries/[inquiryId]/page')

    await expect(page.default({ params: Promise.resolve({ inquiryId: 'x'.repeat(101) }) })).rejects.toThrow('not-found')
    expect(routeMocks.resolveAuth).not.toHaveBeenCalled()
  })
})
