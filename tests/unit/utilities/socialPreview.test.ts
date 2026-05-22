import { describe, expect, it, vi } from 'vitest'

vi.mock('@/utilities/getURL', () => ({
  getServerSideURL: vi.fn(() => 'https://findmydoc.eu/'),
}))

describe('socialPreview', () => {
  it('keeps absolute http(s) URLs unchanged', async () => {
    const { getAbsoluteSiteURL } = await import('@/utilities/socialPreview')

    expect(getAbsoluteSiteURL('https://cdn.example.com/og.jpg')).toBe('https://cdn.example.com/og.jpg')
  })

  it('trims whitespace around absolute URLs', async () => {
    const { getAbsoluteSiteURL } = await import('@/utilities/socialPreview')

    expect(getAbsoluteSiteURL('  https://cdn.example.com/og.jpg  ')).toBe('https://cdn.example.com/og.jpg')
  })

  it('converts protocol-relative URLs to absolute URLs', async () => {
    const { getAbsoluteSiteURL } = await import('@/utilities/socialPreview')

    expect(getAbsoluteSiteURL('//cdn.example.com/og.jpg')).toBe('https://cdn.example.com/og.jpg')
  })

  it('builds absolute URLs for internal paths', async () => {
    const { getAbsoluteSiteURL } = await import('@/utilities/socialPreview')

    expect(getAbsoluteSiteURL('/care')).toBe('https://findmydoc.eu/care')
  })
})
