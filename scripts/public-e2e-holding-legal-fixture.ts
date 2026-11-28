import { getPayload } from 'payload'
import config from '../src/payload.config'
import { MANAGED_LEGAL_PAGE_SLUGS } from '../src/utilities/legalPages'
import { buildRichText } from '../tests/fixtures/richText'
import { deriveDatabaseConfig } from './test-database-harness.mjs'

async function publishGermanTestRenditions() {
  if (process.env.DEPLOYMENT_ENVIRONMENT !== 'test' || !process.env.DATABASE_URI) {
    throw new Error('Holding legal fixtures require an isolated local test database.')
  }
  deriveDatabaseConfig(process.env.DATABASE_URI)
  const payload = await getPayload({ config })

  try {
    for (const slug of MANAGED_LEGAL_PAGE_SLUGS) {
      const {
        docs: [page],
      } = await payload.find({
        collection: 'pages',
        locale: 'en',
        fallbackLocale: false,
        depth: 0,
        limit: 1,
        where: { slug: { equals: slug } },
      })
      if (!page) throw new Error(`Missing English managed legal fixture for ${slug}`)
      const title = `Deutsche Testfassung (${slug})`
      await payload.update({
        collection: 'pages',
        id: page.id,
        locale: 'de',
        fallbackLocale: false,
        publishSpecificLocale: 'de',
        data: {
          title,
          slug,
          generateSlug: false,
          _status: 'published',
          layout: [
            {
              blockType: 'content',
              columns: [{ size: 'full', richText: buildRichText(title) }],
            },
          ],
          meta: { title },
        },
        context: { disableRevalidate: true },
      })
    }
  } finally {
    await payload.destroy()
  }
}

void publishGermanTestRenditions().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
