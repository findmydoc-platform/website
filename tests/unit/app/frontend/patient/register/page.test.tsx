import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
;(globalThis as unknown as { React: typeof React }).React = React

import { PREVIEW_GUARD_ACTIVE_REQUEST_HEADER } from '@/features/previewGuard'

const redirectMock = vi.hoisted(() =>
  vi.fn((destination: string) => {
    throw Object.assign(new Error('NEXT_REDIRECT'), { destination })
  }),
)
const headersMock = vi.hoisted(() => vi.fn(async () => new Headers()))

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}))

vi.mock('next/headers', () => ({
  headers: headersMock,
}))

describe('PatientRegistrationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    headersMock.mockResolvedValue(new Headers())
  })

  const getRegistrationPage = async () => {
    const pageModule = await import('@/app/(frontend)/register/patient/page')
    return pageModule.default
  }

  it('redirects patient creation to the staff-only Payload form when Preview Guard is active', async () => {
    headersMock.mockResolvedValue(
      new Headers({
        [PREVIEW_GUARD_ACTIVE_REQUEST_HEADER]: '1',
      }),
    )
    const PatientRegistrationPage = await getRegistrationPage()

    await expect(PatientRegistrationPage()).rejects.toThrow('NEXT_REDIRECT')
    expect(redirectMock).toHaveBeenCalledWith('/admin/collections/patients/create')
  })

  it('keeps public patient self-registration when Preview Guard is inactive', async () => {
    const PatientRegistrationPage = await getRegistrationPage()

    const result = await PatientRegistrationPage()

    expect(React.isValidElement(result)).toBe(true)
    expect(redirectMock).not.toHaveBeenCalled()
  })
})
