import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const authMock = vi.fn()

vi.mock('payload', () => ({
  getPayload: vi.fn().mockResolvedValue({
    auth: authMock,
    logger: { error: vi.fn() },
  }),
}))

const redirectMock = vi.fn()

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}))

vi.mock('next/headers', () => ({
  draftMode: vi.fn().mockResolvedValue({
    disable: vi.fn(),
    enable: vi.fn(),
  }),
}))

import { GET } from '@/app/(frontend)/next/preview/route'

describe('GET /next/preview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
})
