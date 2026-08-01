import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { authMock, draftDisableMock, draftEnableMock, draftModeMock, redirectMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  draftDisableMock: vi.fn(),
  draftEnableMock: vi.fn(),
  draftModeMock: vi.fn(),
  redirectMock: vi.fn(),
}))

vi.mock('payload', () => ({
  getPayload: vi.fn().mockResolvedValue({
    auth: authMock,
    logger: { error: vi.fn() },
  }),
}))

vi.mock('@payload-config', () => ({
  default: {},
}))

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}))

vi.mock('next/headers', () => ({
  draftMode: draftModeMock,
}))

import { GET } from '@/app/(frontend)/next/preview/route'

describe('GET /next/preview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMock.mockReset()
    draftModeMock.mockResolvedValue({
      disable: draftDisableMock,
      enable: draftEnableMock,
    })
    process.env.PREVIEW_SECRET = 'test-secret'
  })

  it('rejects protocol-relative paths before auth or redirects', async () => {
    const request = new NextRequest(
      'http://localhost/next/preview?path=//evil.example&collection=posts&slug=hello-world&previewSecret=test-secret',
    )

    const response = await GET(request)

    expect(response.status).toBe(500)
    await expect(response.text()).resolves.toBe('This endpoint can only be used for relative previews')
    expect(authMock).not.toHaveBeenCalled()
    expect(redirectMock).not.toHaveBeenCalled()
  })

  it('rejects backslash-based paths that resolve off-origin', async () => {
    const request = new NextRequest(
      'http://localhost/next/preview?path=%2F%5Cevil.example&collection=posts&slug=hello-world&previewSecret=test-secret',
    )

    const response = await GET(request)

    expect(response.status).toBe(500)
    await expect(response.text()).resolves.toBe('This endpoint can only be used for relative previews')
    expect(authMock).not.toHaveBeenCalled()
    expect(redirectMock).not.toHaveBeenCalled()
  })

  it('rejects paths with control characters before auth or redirects', async () => {
    const request = new NextRequest(
      'http://localhost/next/preview?path=%2Fposts%2Fhello%0Aworld&collection=posts&slug=hello-world&previewSecret=test-secret',
    )

    const response = await GET(request)

    expect(response.status).toBe(500)
    await expect(response.text()).resolves.toBe('This endpoint can only be used for relative previews')
    expect(authMock).not.toHaveBeenCalled()
    expect(redirectMock).not.toHaveBeenCalled()
  })

  it('rejects same-origin absolute URLs before auth or redirects', async () => {
    const request = new NextRequest(
      'http://localhost/next/preview?path=http%3A%2F%2Flocalhost%2Fposts%2Fhello-world&collection=posts&slug=hello-world&previewSecret=test-secret',
    )

    const response = await GET(request)

    expect(response.status).toBe(500)
    await expect(response.text()).resolves.toBe('This endpoint can only be used for relative previews')
    expect(authMock).not.toHaveBeenCalled()
    expect(redirectMock).not.toHaveBeenCalled()
  })

  it('redirects with the sanitized relative path after auth succeeds', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1', collection: 'platformStaff' } })

    const request = new NextRequest(
      'http://localhost/next/preview?path=%2Fposts%2Fhello-world%3Fpreview%3D1%23draft&collection=posts&slug=hello-world&previewSecret=test-secret',
    )

    await GET(request)

    expect(authMock).toHaveBeenCalledOnce()
    expect(draftEnableMock).toHaveBeenCalledOnce()
    expect(draftDisableMock).not.toHaveBeenCalled()
    expect(redirectMock).toHaveBeenCalledWith('/posts/hello-world?preview=1#draft')
  })

  it.each([
    ['unauthenticated', null],
    ['clinic staff', { id: 'clinic-user', collection: 'clinicStaff' }],
    ['patient', { id: 'patient-user', collection: 'patients' }],
  ] as const)('rejects %s users and clears any existing draft cookie', async (_label, user) => {
    authMock.mockResolvedValue({ user })
    const request = new NextRequest(
      'http://localhost/next/preview?path=%2Fposts%2Fhello-world&collection=posts&slug=hello-world&previewSecret=test-secret',
    )

    const response = await GET(request)

    expect(response.status).toBe(403)
    expect(draftDisableMock).toHaveBeenCalledOnce()
    expect(draftEnableMock).not.toHaveBeenCalled()
    expect(redirectMock).not.toHaveBeenCalled()
  })

  it('rejects stale authentication without enabling draft mode', async () => {
    authMock.mockRejectedValue(new Error('stale session'))
    const request = new NextRequest(
      'http://localhost/next/preview?path=%2Fposts%2Fhello-world&collection=posts&slug=hello-world&previewSecret=test-secret',
    )

    const response = await GET(request)

    expect(response.status).toBe(403)
    expect(draftDisableMock).toHaveBeenCalledOnce()
    expect(draftEnableMock).not.toHaveBeenCalled()
    expect(redirectMock).not.toHaveBeenCalled()
  })
})
