import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const routerState = vi.hoisted(() => ({ pathname: '/' }))

vi.mock('next/navigation', () => ({
  usePathname: () => routerState.pathname,
}))

import { FrontendChrome } from '@/app/(frontend)/FrontendChrome.client'

describe('frontend route chrome', () => {
  beforeEach(() => {
    routerState.pathname = '/'
  })

  it('hides shared chrome on the Holding root route', () => {
    expect(renderToStaticMarkup(<FrontendChrome holdingMode>Shared chrome</FrontendChrome>)).toBe('')
  })

  it('shows projected shared chrome on an allowed Holding route', () => {
    routerState.pathname = '/posts'

    expect(renderToStaticMarkup(<FrontendChrome holdingMode>Shared chrome</FrontendChrome>)).toContain('Shared chrome')
  })

  it('keeps full mode chrome on the root route', () => {
    expect(renderToStaticMarkup(<FrontendChrome holdingMode={false}>Shared chrome</FrontendChrome>)).toContain(
      'Shared chrome',
    )
  })
})
