import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PUBLIC_SITE_MODE_REQUEST_HEADER } from '@/features/temporaryLandingMode'
import { PREVIEW_GUARD_ACTIVE_REQUEST_HEADER } from '@/features/previewGuard'

const mocks = vi.hoisted(() => ({
  headersMock: vi.fn(),
  getCachedGlobalMock: vi.fn(),
  getServerSideURLMock: vi.fn(() => 'https://findmydoc.eu'),
  headerComponent: vi.fn(() => null),
  footerComponent: vi.fn(() => null),
  previewDataNoticeComponent: vi.fn(() => null),
  extractSupabaseUserDataMock: vi.fn(),
  resolveHoldingModeMock: vi.fn(),
}))

vi.mock('next/headers', () => ({
  headers: mocks.headersMock,
}))

vi.mock('@/utilities/getURL', () => ({
  getServerSideURL: mocks.getServerSideURLMock,
}))

vi.mock('@/utilities/getGlobals', () => ({
  getCachedGlobal: mocks.getCachedGlobalMock,
}))

vi.mock('@/auth/utilities/jwtValidation', () => ({
  extractSupabaseUserData: mocks.extractSupabaseUserDataMock,
}))

vi.mock('@/features/temporaryLandingMode/resolver', () => ({
  resolveHoldingMode: mocks.resolveHoldingModeMock,
}))

vi.mock('@/components/templates/Header/Component', () => ({
  Header: mocks.headerComponent,
}))

vi.mock('@/components/templates/Footer/Component', () => ({
  Footer: mocks.footerComponent,
}))

vi.mock('@/components/templates/PreviewDataNotice/Component', () => ({
  PreviewDataNotice: mocks.previewDataNoticeComponent,
}))

vi.mock('@/components/templates/Header/PublicAccountMenu', () => ({
  PublicAccountMenu: vi.fn(() => null),
}))

describe('frontend route template', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mocks.headersMock.mockResolvedValue(new Headers())
    mocks.getCachedGlobalMock.mockImplementation((slug: string) => async () => {
      if (slug === 'header') {
        return { navItems: [{ link: { type: 'custom', url: '/posts', label: 'Blog' } }] }
      }

      return {
        navGroups: [
          { label: 'Legal', items: [{ link: { type: 'custom', url: '/privacy-policy', label: 'Privacy' } }] },
        ],
      }
    })
    mocks.extractSupabaseUserDataMock.mockResolvedValue(null)
    mocks.resolveHoldingModeMock.mockResolvedValue({ mode: 'full', source: 'posthog' })
  })

  it('renders holding chrome for the effective mode on each route render', async () => {
    mocks.headersMock.mockResolvedValue(new Headers({ [PUBLIC_SITE_MODE_REQUEST_HEADER]: 'holding' }))

    const templateModule = await import('@/app/(frontend)/template')
    const result = await templateModule.default({ children: 'route content' })
    const templateChildren = result.props.children[0].props.children
    const footer = result.props.children[2].props.children.props.children

    expect(templateChildren[0].props.children.type).toBe(mocks.headerComponent)
    expect(templateChildren[0].props.children.props.rightActions).toBeNull()
    expect(result.props.children[1].type).toBe('main')
    expect(result.props.children[1].props.children).toBe('route content')
    expect(footer.type).toBe(mocks.footerComponent)
    expect(footer.props.holdingMode).toBe(true)
  })

  it('restores full chrome when the next route render carries full mode', async () => {
    mocks.headersMock.mockResolvedValue(new Headers({ [PUBLIC_SITE_MODE_REQUEST_HEADER]: 'full' }))

    const templateModule = await import('@/app/(frontend)/template')
    const result = await templateModule.default({ children: 'route content' })
    const templateChildren = result.props.children[0].props.children
    const footer = result.props.children[2].props.children.props.children

    expect(templateChildren[0].props.children.type).toBe(mocks.headerComponent)
    expect(templateChildren[0].props.children.props.rightActions).not.toBeNull()
    expect(footer.props.holdingMode).toBe(false)
  })

  it('resolves Holding mode when the request marker is unavailable', async () => {
    mocks.headersMock.mockResolvedValue(new Headers({ host: 'findmydoc.eu' }))
    mocks.resolveHoldingModeMock.mockResolvedValue({ mode: 'holding', source: 'deployment-fallback' })

    const templateModule = await import('@/app/(frontend)/template')
    const result = await templateModule.default({ children: 'route content' })
    const templateChildren = result.props.children[0].props.children
    const footer = result.props.children[2].props.children.props.children

    expect(mocks.resolveHoldingModeMock).toHaveBeenCalledWith(new URL('http://findmydoc.eu'))
    expect(templateChildren[0].props.children.props.rightActions).toBeNull()
    expect(footer.props.holdingMode).toBe(true)
  })

  it('keeps normal chrome when Preview Guard takes precedence over Holding mode', async () => {
    mocks.headersMock.mockResolvedValue(
      new Headers({
        [PUBLIC_SITE_MODE_REQUEST_HEADER]: 'holding',
        [PREVIEW_GUARD_ACTIVE_REQUEST_HEADER]: '1',
      }),
    )

    const templateModule = await import('@/app/(frontend)/template')
    const result = await templateModule.default({ children: 'guarded route content' })
    const templateChildren = result.props.children[0].props.children
    const footer = result.props.children[2].props.children.props.children

    expect(templateChildren[0].props.children.props.rightActions).not.toBeNull()
    expect(footer.props.holdingMode).toBe(false)
  })
})
