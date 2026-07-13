import { formBuilderPlugin } from '@payloadcms/plugin-form-builder'
import { redirectsPlugin } from '@payloadcms/plugin-redirects'
import { searchPlugin } from '@payloadcms/plugin-search'
import type { CollectionConfig, Config, PayloadRequest } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { revalidateRedirects } from '@/hooks/revalidateRedirects'
import { formBuilderPluginConfig, redirectsPluginConfig, searchPluginConfig } from '@/plugins'
import { beforeSyncWithSearch } from '@/search/beforeSync'
import { searchFields } from '@/search/fieldOverrides'
import { createMockReq } from '../helpers/testHelpers'
import { mockUsers } from '../helpers/mockUsers'

vi.mock('@payloadcms/storage-s3', () => ({
  s3Storage: () => (incomingConfig: unknown) => incomingConfig,
}))

type ManagedPluginCollectionSlug = 'forms' | 'form-submissions' | 'redirects' | 'search'
type ManagedOperation = 'create' | 'read' | 'update' | 'delete' | 'admin'
type Role = 'platform' | 'clinic' | 'patient' | 'anonymous'

const roles = {
  platform: mockUsers.platform(),
  clinic: mockUsers.clinic(),
  patient: mockUsers.patient(),
  anonymous: mockUsers.anonymous(),
} satisfies Record<Role, unknown>

const buildPluginCollections = (): Record<ManagedPluginCollectionSlug, CollectionConfig> => {
  const sourceCollections = ['posts', 'clinics', 'treatments', 'doctors'].map((slug): CollectionConfig => ({
    slug,
    fields: [],
    labels: {
      plural: slug,
      singular: slug,
    },
  }))

  let config = {
    collections: sourceCollections,
  } as Config

  config = redirectsPlugin(redirectsPluginConfig)(config)
  config = formBuilderPlugin(formBuilderPluginConfig)(config)
  config = searchPlugin(searchPluginConfig)(config)

  const findCollection = (slug: ManagedPluginCollectionSlug): CollectionConfig => {
    const collection = config.collections?.find((candidate) => candidate.slug === slug)
    if (!collection) throw new Error(`Expected generated collection: ${slug}`)
    return collection
  }

  return {
    forms: findCollection('forms'),
    'form-submissions': findCollection('form-submissions'),
    redirects: findCollection('redirects'),
    search: findCollection('search'),
  }
}

const collections = buildPluginCollections()

const operationExpectations = [
  ['forms', 'create', ['platform']],
  ['forms', 'read', ['platform', 'clinic', 'patient', 'anonymous']],
  ['forms', 'update', ['platform']],
  ['forms', 'delete', ['platform']],
  ['forms', 'admin', ['platform']],
  ['form-submissions', 'create', ['platform', 'clinic', 'patient', 'anonymous']],
  ['form-submissions', 'read', ['platform']],
  ['form-submissions', 'update', []],
  ['form-submissions', 'delete', ['platform']],
  ['form-submissions', 'admin', ['platform']],
  ['redirects', 'create', ['platform']],
  ['redirects', 'read', ['platform', 'clinic', 'patient', 'anonymous']],
  ['redirects', 'update', ['platform']],
  ['redirects', 'delete', ['platform']],
  ['redirects', 'admin', ['platform']],
  ['search', 'create', []],
  ['search', 'read', ['platform', 'clinic', 'patient', 'anonymous']],
  ['search', 'update', ['platform']],
  ['search', 'delete', ['platform']],
  ['search', 'admin', ['platform']],
] as const satisfies readonly [ManagedPluginCollectionSlug, ManagedOperation, readonly Role[]][]

const findNamedField = (collection: CollectionConfig, name: string) => {
  const visit = (fields: CollectionConfig['fields']): CollectionConfig['fields'][number] | undefined => {
    for (const field of fields) {
      if ('name' in field && field.name === name) return field
      if ('fields' in field && Array.isArray(field.fields)) {
        const nestedField = visit(field.fields)
        if (nestedField) return nestedField
      }
    }

    return undefined
  }

  return visit(collection.fields)
}

describe('managed plugin collection configuration', () => {
  it.each(operationExpectations)('%s %s follows the role matrix', async (slug, operation, allowedRoles) => {
    const access = collections[slug].access?.[operation]
    if (typeof access !== 'function') throw new Error(`Expected ${slug} access.${operation}`)

    for (const [role, user] of Object.entries(roles) as Array<[Role, (typeof roles)[Role]]>) {
      const result = await access({
        req: createMockReq(user) as PayloadRequest,
      } as never)

      expect(result, `${slug} ${operation} for ${role}`).toBe((allowedRoles as readonly Role[]).includes(role))
    }
  })

  it('preserves form fields, rich-text editor overrides, hooks, and admin groups', () => {
    const forms = collections.forms
    const submissions = collections['form-submissions']
    const confirmationMessage = findNamedField(forms, 'confirmationMessage')
    const slug = findNamedField(forms, 'slug')

    expect(forms.admin?.group).toBe('Settings')
    expect(submissions.admin?.group).toBe('Platform Management')
    expect(confirmationMessage).toMatchObject({
      localized: false,
      type: 'richText',
    })
    expect(
      confirmationMessage && 'editor' in confirmationMessage ? confirmationMessage.editor : undefined,
    ).toBeDefined()
    expect(slug).toMatchObject({
      index: true,
      name: 'slug',
      unique: true,
    })
    expect(submissions.hooks?.afterChange).toHaveLength(1)
    expect(submissions.hooks?.beforeChange).toHaveLength(1)
  })

  it('preserves redirect field customization and revalidation', () => {
    const redirects = collections.redirects
    const from = findNamedField(redirects, 'from')

    expect(redirects.admin?.group).toBe('Settings')
    expect(from).toMatchObject({
      admin: {
        description: 'You will need to rebuild the website when changing this field.',
      },
    })
    expect(redirects.hooks?.afterChange).toContain(revalidateRedirects)
  })

  it('preserves search fields, sync hooks, and seed suppression without opening direct create access', async () => {
    const search = collections.search
    const searchFieldNames = search.fields.flatMap((field) => ('name' in field ? [field.name] : []))
    const configuredSearchFieldNames = searchFields.flatMap((field) => ('name' in field ? [field.name] : []))

    expect(search.admin?.group).toBe('Settings')
    expect(searchPluginConfig.beforeSync).toBe(beforeSyncWithSearch)
    expect(searchFieldNames).toEqual(expect.arrayContaining(configuredSearchFieldNames))
    expect(Object.hasOwn(searchPluginConfig.searchOverrides?.access ?? {}, 'create')).toBe(false)

    const skipSync = searchPluginConfig.skipSync
    if (!skipSync) throw new Error('Expected search skipSync hook')

    await expect(
      Promise.resolve(
        skipSync({
          collectionSlug: 'posts',
          doc: {},
          locale: undefined,
          req: createMockReq(null, undefined, { context: { disableSearchSync: true } }),
        }),
      ),
    ).resolves.toBe(true)
    await expect(
      Promise.resolve(
        skipSync({
          collectionSlug: 'posts',
          doc: {},
          locale: undefined,
          req: createMockReq(null),
        }),
      ),
    ).resolves.toBe(false)
  })
})
