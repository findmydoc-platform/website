import { describe, expect, it, vi } from 'vitest'
import FirstAdminSetupPage from '@/app/(frontend)/admin/first-admin/page'

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_HTTP_ERROR_FALLBACK;404')
  }),
}))

describe('FirstAdminSetupPage', () => {
  it('returns a 404 instead of rendering a public bootstrap page', () => {
    expect(() => FirstAdminSetupPage()).toThrow('NEXT_HTTP_ERROR_FALLBACK;404')
  })
})
