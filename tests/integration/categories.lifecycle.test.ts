import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { revalidateTag } from 'next/cache'

import { ensureBaseline } from '../fixtures/ensureBaseline'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { testSlug } from '../fixtures/testSlug'
import { slugify } from '@/utilities/slugify'
import type { Category } from '@/payload-types'

describe('Categories integration - lifecycle and access', () => {
  let payload: Payload
  const slugPrefix = slugify(testSlug('categories.lifecycle.test.ts'))

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
  })

  afterEach(async () => {
    await cleanupTestEntities(payload, 'categories', slugPrefix)
  })

  it('creates a category and generates slug from title', async () => {
    const title = `${slugPrefix} alpha`

    vi.mocked(revalidateTag).mockClear()
    const created = await payload.create({
      collection: 'categories',
      data: { title } as unknown as Category,
      draft: false,
      overrideAccess: true,
    })

    expect(created).toBeDefined()
    expect(created.title).toBe(title)
    expect(created.slug).toBe(slugify(title))
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('preserves a manually supplied slug on create and later title changes', async () => {
    const manualSlug = `${slugPrefix}-manual-initial`
    const created = await payload.create({
      collection: 'categories',
      data: { title: `${slugPrefix} different title`, slug: manualSlug },
      overrideAccess: true,
    })
    expect(created.slug).toBe(manualSlug)

    const updated = await payload.update({
      collection: 'categories',
      id: created.id,
      data: { title: `${slugPrefix} renamed title` },
      overrideAccess: true,
    })
    expect(updated.slug).toBe(manualSlug)
  })

  it('regenerates a locked slug only when generation is explicitly enabled', async () => {
    const created = await payload.create({
      collection: 'categories',
      data: { title: `${slugPrefix} original`, slug: `${slugPrefix}-original-manual` },
      overrideAccess: true,
    })
    const updated = await payload.update({
      collection: 'categories',
      id: created.id,
      data: { title: `${slugPrefix} regenerated`, generateSlug: true },
      overrideAccess: true,
    })
    expect(updated.slug).toBe(`${slugPrefix}-regenerated`)
    expect(updated.generateSlug).toBe(false)
  })

  it('rejects duplicate category slug/title (unique constraint)', async () => {
    const title = `${slugPrefix} duplicate`

    await payload.create({
      collection: 'categories',
      data: { title } as unknown as Category,
      draft: false,
      overrideAccess: true,
    })

    await expect(async () => {
      await payload.create({
        collection: 'categories',
        data: { title } as unknown as Category,
        draft: false,
        overrideAccess: true,
      })
    }).rejects.toThrowError(/slug|unique|duplicate|violates|constraint|categories_slug_idx/i)
  })

  it('updates title without changing slug unless explicitly set', async () => {
    const title = `${slugPrefix} slug lock`

    const created = await payload.create({
      collection: 'categories',
      data: { title } as unknown as Category,
      draft: false,
      overrideAccess: true,
    })

    const updatedTitle = `${slugPrefix} slug lock updated`
    const afterTitleUpdate = await payload.update({
      collection: 'categories',
      id: created.id,
      data: { title: updatedTitle } as unknown as Category,
      overrideAccess: true,
    })

    expect(afterTitleUpdate.title).toBe(updatedTitle)
    expect(afterTitleUpdate.slug).toBe(created.slug)

    const explicitSlug = `${slugPrefix}-explicit`
    const afterSlugUpdate = await payload.update({
      collection: 'categories',
      id: created.id,
      data: { slug: explicitSlug } as unknown as Category,
      overrideAccess: true,
    })

    expect(afterSlugUpdate.slug).toBe(explicitSlug)
  })

  it('stores both titles under one shared slug and invalidates post labels when a translation is added', async () => {
    const category = await payload.create({
      collection: 'categories',
      locale: 'en',
      data: { title: `${slugPrefix} Aftercare`, slug: `${slugPrefix}-aftercare` },
    })

    const german = await payload.findByID({
      collection: 'categories',
      id: category.id,
      locale: 'de',
      fallbackLocale: false,
    })
    expect(german.title).toBeFalsy()

    vi.mocked(revalidateTag).mockClear()
    await payload.update({
      collection: 'categories',
      id: category.id,
      locale: 'de',
      data: { title: 'Nachsorge' },
    })

    const translations = await payload.findByID({
      collection: 'categories',
      id: category.id,
      locale: 'all',
      fallbackLocale: false,
      overrideAccess: false,
    })

    expect(revalidateTag).toHaveBeenCalledWith('collection:categories', { expire: 0 })
    expect(translations).toMatchObject({
      id: category.id,
      slug: `${slugPrefix}-aftercare`,
      title: { en: `${slugPrefix} Aftercare`, de: 'Nachsorge' },
    })
  })

  it('can translate a parent while its English-only child retains its assignment and language', async () => {
    const parent = await payload.create({
      collection: 'categories',
      locale: 'en',
      data: { title: 'Care', slug: `${slugPrefix}-care` },
    })
    const child = await payload.create({
      collection: 'categories',
      locale: 'en',
      data: { title: 'Aftercare', slug: `${slugPrefix}-child`, parent: parent.id },
    })

    await expect(
      payload.update({
        collection: 'categories',
        id: parent.id,
        locale: 'de',
        data: { title: 'Behandlung' },
      }),
    ).resolves.toMatchObject({ title: 'Behandlung' })

    await expect(
      payload.findByID({
        collection: 'categories',
        id: child.id,
        locale: 'all',
        depth: 0,
        fallbackLocale: false,
      }),
    ).resolves.toMatchObject({
      parent: parent.id,
      title: { en: 'Aftercare' },
      breadcrumbs: {
        de: [{ label: 'Behandlung' }, { label: 'Aftercare' }],
        en: [{ label: 'Care' }, { label: 'Aftercare' }],
      },
    })
    const german = await payload.findByID({
      collection: 'categories',
      id: child.id,
      locale: 'de',
      fallbackLocale: false,
    })
    expect(german.title).toBeFalsy()

    for (const search of ['Care', 'Behandlung']) {
      const result = await payload.find({
        collection: 'categories',
        locale: 'de',
        select: { titleSearch: true },
        where: { and: [{ id: { equals: parent.id } }, { titleSearch: { contains: search } }] },
      })
      expect(result.docs).toMatchObject([{ id: parent.id, titleSearch: 'Behandlung / Care' }])
    }
  })

  it('keeps both updates or rejects a stale write when two locales are edited concurrently', async () => {
    const category = await payload.create({
      collection: 'categories',
      locale: 'en',
      data: { title: 'Care', slug: `${slugPrefix}-concurrent` },
    })
    const changes = [
      { locale: 'en', title: 'Patient care' },
      { locale: 'de', title: 'Behandlung' },
    ] as const
    const update = ({ locale, title }: (typeof changes)[number]) =>
      payload.update({ collection: 'categories', id: category.id, locale, data: { title } })

    const results = await Promise.allSettled(changes.map(update))
    expect(results.some(({ status }) => status === 'fulfilled')).toBe(true)
    const saved = await payload.findByID({
      collection: 'categories',
      id: category.id,
      locale: 'all',
      fallbackLocale: false,
    })
    for (const [index, result] of results.entries()) {
      const change = changes[index]!
      if (result.status === 'fulfilled') {
        expect(saved.title).toMatchObject({ [change.locale]: change.title })
      } else {
        expect(result.reason.cause?.message ?? result.reason.message).toMatch(/Category changed while saving/)
        await expect(update(change)).resolves.toMatchObject({ title: change.title })
      }
    }
    await expect(
      payload.findByID({
        collection: 'categories',
        id: category.id,
        locale: 'all',
      }),
    ).resolves.toMatchObject({ title: { en: 'Patient care', de: 'Behandlung' } })
  })

  it('deletes a category and removes it from queries', async () => {
    const title = `${slugPrefix} delete me`

    const created = await payload.create({
      collection: 'categories',
      data: { title } as unknown as Category,
      draft: false,
      overrideAccess: true,
    })

    vi.mocked(revalidateTag).mockClear()
    const deleted = await payload.delete({
      collection: 'categories',
      id: created.id,
      overrideAccess: true,
    })

    expect(deleted).toBeDefined()
    expect(revalidateTag).toHaveBeenCalledWith('collection:categories', { expire: 0 })

    const findResult = await payload.find({
      collection: 'categories',
      where: { id: { equals: created.id } },
      overrideAccess: true,
    })

    expect(findResult.docs).toHaveLength(0)

    await expect(
      payload.findByID({
        collection: 'categories',
        id: created.id,
        overrideAccess: true,
      }),
    ).rejects.toThrow()
  })

  it('rejects missing title', async () => {
    await expect(
      payload.create({
        collection: 'categories',
        data: {},
        draft: false,
        overrideAccess: true,
      } as unknown as Parameters<Payload['create']>[0]),
    ).rejects.toThrow()
  })

  it('allows public read but blocks unauthenticated create', async () => {
    const title = `${slugPrefix} public-read`

    const created = await payload.create({
      collection: 'categories',
      data: { title } as unknown as Category,
      draft: false,
      overrideAccess: true,
    })

    const publicRead = await payload.find({
      collection: 'categories',
      where: { id: { equals: created.id } },
      overrideAccess: false,
    })

    expect(publicRead.docs).toHaveLength(1)
    expect(publicRead.docs[0]?.title).toBe(title)

    await expect(async () => {
      await payload.create({
        collection: 'categories',
        data: { title: `${slugPrefix} should-fail` } as unknown as Category,
        draft: false,
        overrideAccess: false,
      })
    }).rejects.toThrow()
  })
})
