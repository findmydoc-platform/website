import { getPayload } from 'payload'
import type { Where } from 'payload'

import { localizedFormConfirmation, localizedFormScenario } from '../tests/fixtures/localizedFormScenario'
import { buildRichText } from '../tests/fixtures/richText'
import { deriveDatabaseConfig } from './test-database-harness.mjs'

async function main() {
  const [command, prefix, mode] = process.argv.slice(2)
  if ((command !== 'create' && command !== 'cleanup') || !prefix || !/^e2e-localized-form-\d+$/.test(prefix)) {
    throw new Error('Expected create or cleanup with an e2e-localized-form timestamp prefix.')
  }
  if (mode !== 'full' && mode !== 'holding') throw new Error('Expected a Full or Holding test mode.')
  if (process.env.DEPLOYMENT_ENVIRONMENT !== 'test') throw new Error('This fixture requires the test runtime.')

  process.env.DATABASE_URI = deriveDatabaseConfig(process.env.DATABASE_URI?.trim() || undefined).connectionString
  const { default: config } = await import('../src/payload.config')
  const payload = await getPayload({ config })
  const context = { disableRevalidate: true }
  const locales = ['de', 'en'] as const
  const formSlugs = locales.map((locale) => `${prefix}-${locale}`)
  const ownedForms: Where = {
    or: [{ slug: { in: formSlugs } }, { and: [{ slug: { equals: 'public-contact' } }, { title: { equals: prefix } }] }],
  }

  try {
    if (command === 'cleanup') {
      const forms = await payload.find({ collection: 'forms', where: ownedForms, pagination: false, depth: 0 })
      if (forms.docs.length) {
        await payload.delete({
          collection: 'form-submissions',
          where: { form: { in: forms.docs.map(({ id }) => id) } },
        })
      }
      await payload.delete({ collection: 'pages', where: { slug: { equals: formSlugs[0] } }, locale: 'de', context })
      await payload.delete({ collection: 'forms', where: ownedForms })
      return
    }

    const existingContact = await payload.find({
      collection: 'forms',
      where: { slug: { equals: 'public-contact' } },
      limit: 1,
      depth: 0,
    })
    if (existingContact.docs.length) {
      throw new Error('The isolated test database already has a contact form. Use a clean test database.')
    }
    await payload.create({
      collection: 'forms',
      data: {
        title: prefix,
        slug: 'public-contact',
        generateSlug: false,
        confirmationType: 'message',
        confirmationMessage: buildRichText('Synthetic contact sink.'),
        fields: [
          { blockType: 'text', name: 'name', required: true },
          { blockType: 'email', name: 'email', required: true },
          { blockType: 'textarea', name: 'message', required: true },
        ],
        emails: [],
      },
    })
    if (mode === 'holding') return

    const createLocalizedForm = async (locale: (typeof locales)[number]) => {
      const copy = localizedFormScenario[locale]
      const slug = `${prefix}-${locale}`
      const form = await payload.create({
        collection: 'forms',
        data: {
          title: copy.title,
          slug,
          generateSlug: false,
          fields: [
            { blockType: 'text', name: 'name', label: copy.name, required: true },
            { blockType: 'message', message: buildRichText(copy.hint) },
            {
              blockType: 'select',
              name: 'category',
              label: copy.category,
              placeholder: copy.categoryPrompt,
              options: [{ label: copy.option, value: 'technical' }],
              required: true,
            },
          ],
          submitButtonLabel: copy.submit,
          confirmationType: 'message',
          confirmationMessage: localizedFormConfirmation(locale),
          emails: [],
        },
      })
      return {
        title: copy.title,
        slug,
        generateSlug: false,
        layout: [{ blockType: 'formBlock' as const, form: form.id }],
      }
    }
    const [german, english] = await Promise.all([createLocalizedForm('de'), createLocalizedForm('en')])
    const page = await payload.create({ collection: 'pages', locale: 'de', data: german, draft: true, context })
    await payload.update({ collection: 'pages', id: page.id, locale: 'en', data: english, draft: true, context })
    for (const locale of locales) {
      await payload.update({
        collection: 'pages',
        id: page.id,
        locale,
        publishSpecificLocale: locale,
        data: { _status: 'published' },
        context,
      })
    }
  } finally {
    await payload.destroy()
  }
}

void main().then(
  () => process.exit(0),
  (error: unknown) => {
    console.error(error)
    process.exit(1)
  },
)
