import { getPayload } from 'payload'
import config from '../src/payload.config'
import { buildRichText } from '../tests/fixtures/richText'
import { deriveDatabaseConfig } from './test-database-harness.mjs'

const localizedPage = (title: string) => ({
  title,
  slug: 'home',
  generateSlug: false,
  layout: [
    {
      blockType: 'content' as const,
      columns: [{ size: 'full' as const, richText: buildRichText(title) }],
    },
  ],
  meta: { title },
})

async function stageHomePage() {
  const scenario = process.env.E2E_FULL_HOME_SCENARIO
  if (
    (scenario !== 'bilingual' && scenario !== 'german-only') ||
    process.env.DEPLOYMENT_ENVIRONMENT !== 'test' ||
    !process.env.DATABASE_URI
  ) {
    throw new Error('Full home fixtures require a supported scenario and an isolated local test database.')
  }
  deriveDatabaseConfig(process.env.DATABASE_URI)
  const payload = await getPayload({ config })

  try {
    const { docs } = await payload.find({
      collection: 'pages',
      locale: 'de',
      fallbackLocale: false,
      depth: 0,
      limit: 1,
      where: { slug: { equals: 'home' } },
    })
    const page =
      docs[0] ??
      (await payload.create({
        collection: 'pages',
        locale: 'de',
        fallbackLocale: false,
        publishAllLocales: false,
        data: { ...localizedPage('German homepage CMS fixture'), _status: 'published' },
        context: { disableRevalidate: true },
      }))
    const draft = scenario === 'german-only'
    await payload.update({
      collection: 'pages',
      id: page.id,
      locale: 'en',
      fallbackLocale: false,
      draft,
      ...(draft ? {} : { publishSpecificLocale: 'en' }),
      data: { ...localizedPage('English homepage CMS fixture'), _status: draft ? 'draft' : 'published' },
      context: { disableRevalidate: true },
    })
  } finally {
    await payload.destroy()
  }
}

void stageHomePage().then(
  () => process.exit(0),
  (error: unknown) => {
    console.error(error)
    process.exit(1)
  },
)
