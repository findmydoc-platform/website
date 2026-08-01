import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  disableDraftMock: vi.fn(),
  redirectMock: vi.fn(),
}))

vi.mock('next/headers', () => ({
  draftMode: vi.fn().mockResolvedValue({
    disable: mocks.disableDraftMock,
  }),
}))

vi.mock('next/navigation', () => ({
  redirect: mocks.redirectMock,
}))

import { GET } from '@/app/(frontend)/next/exit-preview/route'

describe('GET /next/exit-preview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('clears draft mode without requiring a redirect', async () => {
    const response = await GET(new NextRequest('http://localhost/next/exit-preview'))

    expect(mocks.disableDraftMock).toHaveBeenCalledOnce()
    expect(mocks.redirectMock).not.toHaveBeenCalled()
    expect(response.status).toBe(200)
    await expect(response.text()).resolves.toBe('Draft mode is disabled')
  })

  it('clears draft mode before redirecting to a sanitized internal path', async () => {
    await GET(new NextRequest('http://localhost/next/exit-preview?redirect=%2Fadmin%2Flogin%3Freason%3Dlogout'))

    expect(mocks.disableDraftMock).toHaveBeenCalledOnce()
    expect(mocks.redirectMock).toHaveBeenCalledWith('/admin/login?reason=logout')
    expect(mocks.disableDraftMock.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.redirectMock.mock.invocationCallOrder[0]!,
    )
  })

  it.each([
    ['external URL', 'https://evil.example'],
    ['protocol-relative URL', '//evil.example'],
    ['exit-preview loop', '/next/exit-preview?redirect=/admin/login'],
  ])('falls back to the homepage for an invalid %s redirect', async (_label, redirectTarget) => {
    const request = new NextRequest(`http://localhost/next/exit-preview?redirect=${encodeURIComponent(redirectTarget)}`)

    await GET(request)

    expect(mocks.disableDraftMock).toHaveBeenCalledOnce()
    expect(mocks.redirectMock).toHaveBeenCalledWith('/')
  })
})
