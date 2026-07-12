import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { revalidatePath, revalidateTag } from 'next/cache'
import type { GlobalAfterChangeHook, PayloadRequest } from 'payload'

import { revalidateCookieConsent } from '@/globals/CookieConsent/hooks/revalidateCookieConsent'
import { revalidateFooter } from '@/globals/Footer/hooks/revalidateFooter'
import { revalidateHeader } from '@/globals/Header/hooks/revalidateHeader'
import { revalidateLandingPages } from '@/globals/LandingPages/hooks/revalidateLandingPages'
import { createMockReq } from '../helpers/testHelpers'

const GLOBAL_HOOK_FILES = [
  'src/globals/Header/hooks/revalidateHeader.ts',
  'src/globals/Footer/hooks/revalidateFooter.ts',
  'src/globals/LandingPages/hooks/revalidateLandingPages.ts',
  'src/globals/CookieConsent/hooks/revalidateCookieConsent.ts',
  'src/collections/Pages/hooks/revalidatePage.ts',
  'src/collections/Posts/hooks/revalidatePost.ts',
  'src/hooks/revalidateRedirects.ts',
] as const

type HookArgs = Parameters<GlobalAfterChangeHook>[0]

const buildReq = (disableRevalidate = false): PayloadRequest =>
  createMockReq(null, undefined, {
    context: {
      disableRevalidate,
    },
  })

const buildArgs = (req: PayloadRequest): HookArgs => ({
  context: req.context,
  data: {},
  doc: { id: 'global-doc' },
  global: { slug: 'header' } as unknown as HookArgs['global'],
  previousDoc: undefined,
  req,
})

const getPathCalls = () => vi.mocked(revalidatePath).mock.calls.map(([path]) => path)
const getTagCalls = () => vi.mocked(revalidateTag).mock.calls.map(([tag]) => tag)

describe('global revalidation hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('routes Header, Footer, and CookieConsent through canonical shared-public tags', async () => {
    const req = buildReq(false)

    expect(revalidateHeader(buildArgs(req))).toEqual({ id: 'global-doc' })
    expect(revalidateFooter(buildArgs(req))).toEqual({ id: 'global-doc' })
    await expect(revalidateCookieConsent(buildArgs(req))).resolves.toEqual({ id: 'global-doc' })

    expect(getTagCalls()).toEqual([
      'global:header',
      'surface:public-chrome',
      'global:footer',
      'surface:public-chrome',
      'global:cookieConsent',
      'surface:public-chrome',
    ])
    expect(getPathCalls()).toEqual([])
  })

  it('routes LandingPages through canonical tags and known paths', () => {
    const req = buildReq(false)

    expect(revalidateLandingPages(buildArgs(req))).toEqual({ id: 'global-doc' })

    expect(getTagCalls()).toEqual([
      'global:landingPages',
      'surface:home',
      'surface:about',
      'surface:partners-clinics',
      'surface:sitemap:pages',
    ])
    expect(getPathCalls()).toEqual(['/', '/about', '/partners/clinics'])
  })

  it('skips planning and execution when disabled through context', async () => {
    const req = buildReq(true)

    revalidateHeader(buildArgs(req))
    revalidateFooter(buildArgs(req))
    revalidateLandingPages(buildArgs(req))
    await revalidateCookieConsent(buildArgs(req))

    expect(getTagCalls()).toEqual([])
    expect(getPathCalls()).toEqual([])
  })

  it('keeps migrated core hooks off direct next/cache imports and legacy tags', () => {
    for (const filePath of GLOBAL_HOOK_FILES) {
      const source = readFileSync(join(process.cwd(), filePath), 'utf8')

      expect(source).not.toContain('next/cache')
      expect(source).not.toMatch(/global_(header|footer|landingPages|cookieConsent)/)
      expect(source).not.toContain('pages-sitemap')
      expect(source).not.toContain('posts-sitemap')
      expect(source).not.toContain("revalidateTag('redirects'")
    }
  })
})
