import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
;(globalThis as unknown as { React: typeof React }).React = React

const redirectMock = vi.hoisted(() =>
  vi.fn((destination: string) => {
    throw Object.assign(new Error('NEXT_REDIRECT'), { destination })
  }),
)

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}))

describe('PatientRegistrationPage', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      DEPLOYMENT_ENV: undefined,
      VERCEL_ENV: undefined,
      NODE_ENV: 'development',
    }
    vi.clearAllMocks()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  const getRegistrationPage = async () => {
    const pageModule = await import('@/app/(frontend)/register/patient/page')
    return pageModule.default
  }

  it('redirects preview patient creation to the staff-only Payload form', async () => {
    process.env.VERCEL_ENV = 'preview'
    const PatientRegistrationPage = await getRegistrationPage()

    await expect(PatientRegistrationPage()).rejects.toThrow('NEXT_REDIRECT')
    expect(redirectMock).toHaveBeenCalledWith('/admin/collections/patients/create')
  })

  it('keeps production patient self-registration unchanged', async () => {
    process.env.VERCEL_ENV = 'production'
    const PatientRegistrationPage = await getRegistrationPage()

    const result = await PatientRegistrationPage()

    expect(React.isValidElement(result)).toBe(true)
    expect(redirectMock).not.toHaveBeenCalled()
  })
})
