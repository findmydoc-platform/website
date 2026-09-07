import { expect, type APIRequestContext, type Page } from '@playwright/test'
import sharp from 'sharp'
import { buildRichText } from '../../../../fixtures/richText'
import { getFirstCollectionDoc, getRecordId } from '../../adminApi'
import { fillAdminRichTextField, getAdminFieldRoot, openAdminDocumentPage, openAdminTab } from '../../adminUI'
import type { AdminJourneyDefinition } from '../types'

type PostState = { slug: string }

const readPost = async (request: APIRequestContext, id: string | number, draft = true) => {
  const response = await request.get(`/api/posts/${id}?depth=0&locale=en&draft=${draft}`)
  expect(response.ok()).toBeTruthy()
  return response.json()
}

const savePost = async (page: Page, id: string | number, label: RegExp) => {
  const response = page.waitForResponse((candidate) => {
    const url = new URL(candidate.url())
    return (
      candidate.request().method() === 'PATCH' &&
      url.pathname === `/api/posts/${id}` &&
      url.searchParams.get('autosave') !== 'true'
    )
  })
  await page.getByRole('button', { name: label }).first().click()
  expect((await response).ok()).toBeTruthy()
}

export const postPublishingJourney: AdminJourneyDefinition<PostState> = {
  createState: () => ({ slug: `e2e-post-lifecycle-${Date.now()}` }),
  description:
    'Edit, publish, revise and unpublish a complete article, checking anonymous delivery after each transition.',
  journeyId: 'admin.posts.publish-lifecycle',
  metadata: {
    collections: ['posts', 'categories', 'tags', 'platformContentMedia'],
    consumers: ['regression'],
    entrypoints: ['document-page'],
    riskTags: ['publishing', 'public-content', 'media', 'draft-isolation'],
  },
  persona: 'admin',
  steps: [
    {
      stepId: 'article-publication-lifecycle',
      label: 'Verify the complete article lifecycle',
      kind: 'save',
      async run({ page, request, state }) {
        const created: Array<{ collection: string; id: string | number }> = []
        const browser = page.context().browser()
        if (!browser) throw new Error('The publishing journey requires a browser.')
        const publicContext = await browser.newContext({ storageState: { cookies: [], origins: [] } })
        const publicPage = await publicContext.newPage()
        const origin = new URL(page.url()).origin
        const publicUrl = `${origin}/posts/${state.slug}`
        const create = async (collection: string, data: Record<string, unknown>) => {
          const response = await request.post(`/api/${collection}?locale=en&draft=true`, { data })
          expect(response.ok()).toBeTruthy()
          const { doc } = await response.json()
          const id = getRecordId(doc?.id)
          if (id === undefined) throw new Error(`Missing ${collection} fixture ID`)
          created.push({ collection, id })
          return id
        }
        try {
          const category = await create('categories', { title: state.slug, slug: state.slug })
          const tag = await create('tags', { name: state.slug, slug: state.slug })
          const author = getRecordId(await getFirstCollectionDoc(request, '/api/platformStaff?limit=1&depth=0'))
          expect(author).toBeTruthy()
          const upload = await request.post('/api/platformContentMedia', {
            multipart: {
              _payload: JSON.stringify({ alt: state.slug }),
              file: {
                name: `${state.slug}.png`,
                mimeType: 'image/png',
                buffer: await sharp({
                  create: { width: 1600, height: 900, channels: 3, background: '#38bda6' },
                })
                  .png()
                  .toBuffer(),
              },
            },
          })
          expect(upload.ok()).toBeTruthy()
          const media = (await upload.json()).doc
          const mediaId = getRecordId(media)
          if (mediaId === undefined) throw new Error('Missing uploaded image ID')
          created.push({ collection: 'platformContentMedia', id: mediaId })
          const fields = {
            slug: state.slug,
            title: `${state.slug} initial`,
            excerpt: 'Initial article summary',
            content: buildRichText('Initial article body'),
            categories: [category],
            tags: [tag],
            authors: [author],
            heroImage: mediaId,
            publishedAt: new Date().toISOString(),
            meta: { title: 'Article SEO title', description: 'Article SEO description', image: mediaId },
          }
          const id = await create('posts', { ...fields, _status: 'draft' })
          await openAdminDocumentPage(page, 'posts', id)
          const title = `${state.slug} edited`
          await getAdminFieldRoot(page, 'title').getByRole('textbox').fill(title)
          await openAdminTab(page, 'Content')
          await getAdminFieldRoot(page, 'excerpt').getByRole('textbox').fill('Edited article summary')
          await fillAdminRichTextField(page, 'Content', 'Edited article body', { fieldPath: 'content' })
          await expect
            .poll(
              async () => {
                const doc = await readPost(request, id)
                return (
                  doc.title === title &&
                  doc.excerpt === 'Edited article summary' &&
                  JSON.stringify(doc.content).includes('Edited article body')
                )
              },
              { timeout: 15000 },
            )
            .toBe(true)
          await page.reload()
          await expect(getAdminFieldRoot(page, 'title').getByRole('textbox')).toHaveValue(title)
          const expected = { ...fields, title, excerpt: 'Edited article summary' }
          const assertFields = async (status: 'draft' | 'published', expectedTitle = title) => {
            const doc = await readPost(request, id)
            expect(doc).toMatchObject({
              ...expected,
              title: expectedTitle,
              content: expect.any(Object),
              _status: status,
            })
            expect(JSON.stringify(doc.content)).toContain('Edited article body')
          }
          const assertHidden = async () => {
            const response = await publicPage.goto(publicUrl)
            expect(response?.status()).toBe(404)
            await publicPage.goto(`${origin}/posts`)
            await expect(publicPage.locator(`a[href="/posts/${state.slug}"]`)).toHaveCount(0)
            const api = await publicContext.request.get(`${origin}/api/posts?where[slug][equals]=${state.slug}`)
            expect(api.ok()).toBeTruthy()
            expect((await api.json()).docs).toHaveLength(0)
          }
          const assertPublic = async (expectedTitle: string) => {
            const response = await publicPage.goto(publicUrl)
            expect(response?.status()).toBe(200)
            await expect(publicPage.getByRole('heading', { name: expectedTitle, exact: true })).toBeVisible()
            await expect(publicPage.getByText('Edited article body', { exact: true })).toBeVisible()
            await expect(publicPage.locator('meta[name="description"]')).toHaveAttribute(
              'content',
              fields.meta.description,
            )
            const hero = publicPage.locator(`img[src*="${state.slug}"], img[srcset*="${state.slug}"]`).first()
            await expect(hero).toBeVisible()
            await expect
              .poll(() => hero.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
              .toBe(true)
            await publicPage.goto(`${origin}/posts`)
            await expect(publicPage.locator(`a[href="/posts/${state.slug}"]`).first()).toBeVisible()
            const api = await publicContext.request.get(`${origin}/api/posts?where[slug][equals]=${state.slug}`)
            expect(api.ok()).toBeTruthy()
            expect((await api.json()).docs[0]).toMatchObject({ title: expectedTitle, _status: 'published' })
          }
          await assertFields('draft')
          await assertHidden()
          await savePost(page, id, /^Publish(?: changes)?$/i)
          await page.reload()
          await assertFields('published')
          const versions = await request.get(
            `/api/posts/versions?where[parent][equals]=${id}&where[version._status][equals]=published`,
          )
          expect(versions.ok()).toBeTruthy()
          expect((await versions.json()).totalDocs).toBeGreaterThan(0)
          await assertPublic(title)
          const revisedTitle = `${state.slug} revised`
          await getAdminFieldRoot(page, 'title').getByRole('textbox').fill(revisedTitle)
          await expect.poll(async () => (await readPost(request, id)).title, { timeout: 15000 }).toBe(revisedTitle)
          await page.reload()
          await assertFields('draft', revisedTitle)
          expect((await readPost(request, id, false)).title).toBe(title)
          await assertPublic(title)
          await savePost(page, id, /^Publish(?: changes)?$/i)
          await page.reload()
          await assertFields('published', revisedTitle)
          await assertPublic(revisedTitle)
          // Payload exposes document actions in its unlabeled dots popup.
          await page.locator('.doc-controls__popup button').first().click()
          await page.getByRole('button', { name: /^Unpublish$/i }).click()
          await page.getByRole('button', { name: /^Confirm$/i }).click()
          await expect.poll(async () => (await readPost(request, id))._status).toBe('draft')
          await page.reload()
          await assertFields('draft', revisedTitle)
          await assertHidden()
        } finally {
          await publicContext.close()
          const failures: string[] = []
          for (const { collection, id } of created.reverse()) {
            try {
              const response = await request.delete(`/api/${collection}/${id}`)
              if (!response.ok()) failures.push(`${collection}/${id}: ${response.status()}`)
            } catch {
              failures.push(`${collection}/${id}: request failed`)
            }
          }
          expect(failures, 'Every owned fixture must be cleaned up').toEqual([])
        }
      },
    },
  ],
}
