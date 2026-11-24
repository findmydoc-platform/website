import { describe, expect, test } from 'vitest'

import {
  constrainPublicLocalizedRead,
  readLocalizedPublicationAccess,
} from '@/collections/common/localizedPublicationAccess'
import { mockUsers } from '../helpers/mockUsers'
import { createMockReq } from '../helpers/testHelpers'

type ReadHookArgs = Extract<Parameters<typeof constrainPublicLocalizedRead>[0], { operation: 'read' }>

describe('localized publication read policy', () => {
  test('public single-document reads serialize only the selected published locale', async () => {
    const req = createMockReq(null, undefined, { locale: 'de', fallbackLocale: 'en' })
    const collection = { slug: 'pages' } as ReadHookArgs['collection']
    const args = { id: 1, collection: { config: collection }, req, draft: true, flattenLocales: false }

    const read = await constrainPublicLocalizedRead({
      args,
      collection,
      context: {},
      operation: 'read',
      overrideAccess: false,
      req,
    })

    expect(read).toMatchObject({
      draft: false,
      flattenLocales: true,
      req: { locale: 'de', fallbackLocale: false },
    })
    await expect(readLocalizedPublicationAccess({ req })).resolves.toEqual({ _status: { equals: 'published' } })
  })

  test('only platform staff can read all locales through collection access', async () => {
    const publicRequest = createMockReq(null, undefined, { locale: 'all' })
    const staffRequest = createMockReq(mockUsers.platform(), undefined, { locale: 'all' })

    await expect(readLocalizedPublicationAccess({ req: publicRequest })).resolves.toBe(false)
    await expect(readLocalizedPublicationAccess({ req: staffRequest })).resolves.toBe(true)
  })

  test.each([
    { reader: 'platform staff', user: mockUsers.platform(), overrideAccess: false },
    { reader: 'trusted local code', user: null, overrideAccess: true },
  ])('$reader can request localized draft data', async ({ user, overrideAccess }) => {
    const req = createMockReq(user, undefined, { locale: 'all' })
    const collection = { slug: 'posts' } as ReadHookArgs['collection']
    const args = { id: 1, collection: { config: collection }, req, draft: true, flattenLocales: false }

    const read = await constrainPublicLocalizedRead({
      args,
      collection,
      context: {},
      operation: 'read',
      overrideAccess,
      req,
    })

    expect(read).toMatchObject({ draft: true, flattenLocales: false, req: { locale: 'all' } })
  })
})
