// @vitest-environment jsdom
import React from 'react'
import '@testing-library/jest-dom'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CmsLanguageSwitchRoute } from '@/features/languageSwitch/CmsLanguageSwitchRoute.client'
import { LanguageSwitchRouteProvider } from '@/features/languageSwitch/LanguageSwitchRouteProvider.client'
import { HOLDING_VIEW_REQUEST_HEADER, PUBLIC_SITE_MODE_REQUEST_HEADER } from '@/features/temporaryLandingMode'
import { FRONTEND_PATH_HEADER } from '@/i18n/requestLocale'

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  extractSupabaseUserData: vi.fn(),
  resolveHoldingMode: vi.fn(),
  pathname: '/',
}))

vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({
  getPayload: async () => ({
    find: async ({ locale }: { locale: string }) => ({
      docs: [{ slug: 'imprint' }, ...(locale === 'de' ? [{ slug: 'privacy-policy' }] : [])],
    }),
  }),
}))

vi.mock('next/headers', () => ({ headers: mocks.headers }))
vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))
vi.mock('@/auth/utilities/jwtValidation', () => ({
  extractSupabaseUserData: mocks.extractSupabaseUserData,
}))
vi.mock('@/features/temporaryLandingMode/resolver', () => ({ resolveHoldingMode: mocks.resolveHoldingMode }))
vi.mock('@/utilities/getURL', () => ({ getServerSideURL: () => 'https://findmydoc.eu' }))
vi.mock('@/utilities/getGlobals', () => ({
  getCachedGlobal: (slug: string) => async () => {
    const links = [
      { link: { type: 'custom', url: '/posts', label: 'Blog' } },
      { link: { type: 'custom', url: '/listing-comparison', label: 'Compare clinics' } },
    ]
    return slug === 'header' ? { navItems: links } : { aboutLinks: links }
  },
}))

async function renderTemplate() {
  const { default: FrontendTemplate } = await import('@/app/(frontend)/template')
  return render(await FrontendTemplate({ children: <h1>Page content</h1> }))
}

describe('platform navigation during Holding mode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('DEPLOYMENT_ENVIRONMENT', 'production')
    mocks.pathname = '/'
    mocks.headers.mockResolvedValue(new Headers({ [PUBLIC_SITE_MODE_REQUEST_HEADER]: 'holding' }))
    mocks.resolveHoldingMode.mockResolvedValue({ mode: 'holding', source: 'deployment-fallback' })
    mocks.extractSupabaseUserData.mockResolvedValue({
      supabaseUserId: 'platform-staff',
      userType: 'platform',
      userEmail: 'staff@example.com',
    })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
  })

  it.each(['/', '/posts'])('shows the complete header and footer to a platform user on %s', async (pathname) => {
    mocks.pathname = pathname
    await renderTemplate()

    const header = screen.getByRole('banner')
    const footer = screen.getByRole('contentinfo')
    expect(within(header).getByRole('link', { name: 'Compare clinics' })).toHaveAttribute('href', '/listing-comparison')
    expect(within(footer).getByRole('link', { name: 'Compare clinics' })).toHaveAttribute('href', '/listing-comparison')
    expect(within(footer).getAllByRole('link', { name: 'Instagram' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: 'Page content' })).toBeInTheDocument()
  })

  it('announces the shared Preview notice in English on a German Post', async () => {
    vi.stubEnv('DEPLOYMENT_ENVIRONMENT', 'preview')
    mocks.pathname = '/posts/gruener-tee'

    await renderTemplate()

    expect(screen.getByRole('note', { name: 'Preview data notice' })).toHaveAttribute('lang', 'en')
  })

  it.each([null, 'patient', 'clinic'])(
    'keeps the standalone Holding contact page for a visitor with user type %s',
    async (userType) => {
      mocks.pathname = '/contact'
      mocks.headers.mockResolvedValue(
        new Headers({
          [PUBLIC_SITE_MODE_REQUEST_HEADER]: 'holding',
          [HOLDING_VIEW_REQUEST_HEADER]: 'standalone',
        }),
      )
      mocks.extractSupabaseUserData.mockResolvedValue(userType ? { userType } : null)

      await renderTemplate()

      expect(screen.queryByRole('banner')).not.toBeInTheDocument()
      expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Page content' })).toBeInTheDocument()
    },
  )

  it.each([null, 'patient', 'clinic'])('keeps only permitted blog navigation for user type %s', async (userType) => {
    mocks.pathname = '/posts'
    mocks.extractSupabaseUserData.mockResolvedValue(userType ? { userType } : null)

    await renderTemplate()

    const header = screen.getByRole('banner')
    const footer = screen.getByRole('contentinfo')
    expect(within(header).getByRole('link', { name: 'Blog' })).toHaveAttribute('href', '/posts')
    expect(within(footer).getByRole('link', { name: 'Blog' })).toHaveAttribute('href', '/posts')
    expect(screen.queryByRole('link', { name: 'Compare clinics' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Instagram' })).not.toBeInTheDocument()
  })

  it('links from Holding English article navigation to published legal renditions', async () => {
    mocks.pathname = '/en/posts/news'
    mocks.headers.mockResolvedValue(
      new Headers({ [PUBLIC_SITE_MODE_REQUEST_HEADER]: 'holding', [FRONTEND_PATH_HEADER]: mocks.pathname }),
    )
    mocks.extractSupabaseUserData.mockResolvedValue(null)

    await renderTemplate()

    const footer = within(screen.getByRole('contentinfo'))
    expect(footer.getAllByRole('link').some((link) => link.getAttribute('href') === '/en/imprint')).toBe(true)
    for (const fallback of footer.getAllByRole('link', { name: /\(DE\)$/ })) {
      expect(fallback).toHaveAttribute('href', '/privacy-policy')
    }
  })

  it('lets a Holding visitor switch between public versions of the same Post', async () => {
    mocks.pathname = '/posts/gruener-tee'
    mocks.extractSupabaseUserData.mockResolvedValue(null)
    const { default: FrontendTemplate } = await import('@/app/(frontend)/template')
    const template = await FrontendTemplate({
      children: (
        <CmsLanguageSwitchRoute locale="de" targets={{ de: '/posts/gruener-tee', en: '/en/posts/green-tea' }} />
      ),
    })
    render(<LanguageSwitchRouteProvider>{template}</LanguageSwitchRouteProvider>)

    fireEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: /Sprache/i }))

    expect(screen.getByRole('link', { name: 'English' })).toHaveAttribute('href', '/en/posts/green-tea')
    expect(screen.queryByRole('link', { name: 'Compare clinics' })).not.toBeInTheDocument()
  })

  it('keeps full platform navigation when Holding mode is resolved without a request marker', async () => {
    mocks.headers.mockResolvedValue(new Headers({ host: 'findmydoc.eu' }))

    await renderTemplate()

    expect(within(screen.getByRole('banner')).getByRole('link', { name: 'Compare clinics' })).toBeInTheDocument()
    expect(within(screen.getByRole('contentinfo')).getByRole('link', { name: 'Compare clinics' })).toBeInTheDocument()
  })

  it.each(['/posts', '/posts/article', '/posts/page/2'])(
    'projects Holding navigation on Preview for %s',
    async (pathname) => {
      vi.stubEnv('DEPLOYMENT_ENVIRONMENT', 'preview')
      mocks.pathname = pathname
      mocks.extractSupabaseUserData.mockResolvedValue(null)
      await renderTemplate()
      expect(within(screen.getByRole('banner')).getByRole('link', { name: 'Blog' })).toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'Compare clinics' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /open account menu/i })).not.toBeInTheDocument()
    },
  )

  it('uses one validated session for the patient account menu in full mode', async () => {
    mocks.headers.mockResolvedValue(new Headers({ [PUBLIC_SITE_MODE_REQUEST_HEADER]: 'full' }))
    mocks.extractSupabaseUserData.mockResolvedValue({
      userType: 'patient',
      firstName: 'Test',
      lastName: 'Patient',
      userEmail: 'patient@example.com',
    })

    await renderTemplate()

    expect(screen.getByRole('button', { name: 'TP, open account menu' })).toBeInTheDocument()
    expect(mocks.extractSupabaseUserData).toHaveBeenCalledTimes(1)
  })

  it('updates navigation across login and logout renders while the host stays in Holding mode', async () => {
    const view = await renderTemplate()
    expect(within(screen.getByRole('banner')).getByRole('link', { name: 'Compare clinics' })).toBeInTheDocument()

    mocks.extractSupabaseUserData.mockResolvedValue(null)
    const { default: FrontendTemplate } = await import('@/app/(frontend)/template')
    view.rerender(await FrontendTemplate({ children: <h1>Page content</h1> }))
    expect(screen.queryByRole('banner')).not.toBeInTheDocument()
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument()

    mocks.extractSupabaseUserData.mockResolvedValue({ userType: 'platform' })
    view.rerender(await FrontendTemplate({ children: <h1>Page content</h1> }))
    expect(within(screen.getByRole('banner')).getByRole('link', { name: 'Compare clinics' })).toBeInTheDocument()
    expect(within(screen.getByRole('contentinfo')).getByRole('link', { name: 'Compare clinics' })).toBeInTheDocument()
  })
})
