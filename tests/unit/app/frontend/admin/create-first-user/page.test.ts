import { describe, expect, it, vi } from 'vitest'
import PayloadCreateFirstUserFallbackPage from '@/app/(frontend)/admin/create-first-user/page'

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_HTTP_ERROR_FALLBACK;404')
  }),
}))

describe('PayloadCreateFirstUserFallbackPage', () => {
  it('returns a 404 for Payload default create-first-user route', () => {
    expect(() => PayloadCreateFirstUserFallbackPage()).toThrow('NEXT_HTTP_ERROR_FALLBACK;404')
  })
})
