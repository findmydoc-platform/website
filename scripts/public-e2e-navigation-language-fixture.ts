import { getPayload } from 'payload'

import { navigationLanguageScenario } from '../tests/fixtures/navigationLanguageScenario'
import { buildRichText } from '../tests/fixtures/richText'
import { deriveDatabaseConfig } from './test-database-harness.mjs'

async function main() {
  if (process.env.DEPLOYMENT_ENVIRONMENT !== 'test' || !process.env.DATABASE_URI) {
    throw new Error('Navigation language fixtures require an isolated local test database.')
  }
  process.env.DATABASE_URI = deriveDatabaseConfig(process.env.DATABASE_URI).connectionString
  const { default: config } = await import('../src/payload.config')
  const payload = await getPayload({ config })
  const title = 'Testseite mit deutscher Veröffentlichung'
  const context = { disableRevalidate: true }

  try {
    const page = await payload.create({
      collection: 'pages',
      locale: 'de',
      draft: true,
      context,
      data: {
        title,
        slug: navigationLanguageScenario.germanOnlyPage,
        generateSlug: false,
        layout: [{ blockType: 'content', columns: [{ size: 'full', richText: buildRichText(title) }] }],
      },
    })
    await payload.update({
      collection: 'pages',
      id: page.id,
      locale: 'de',
      publishSpecificLocale: 'de',
      data: { _status: 'published' },
      context,
    })
  } finally {
    await payload.destroy()
  }
}

void main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
