import type { Access, CollectionConfig, PayloadHandler } from 'payload'

import { anyone } from '@/access/anyone'
import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'

const denyAllCollectionAccess: Access = () => false

const platformAdminAccess: NonNullable<CollectionConfig['access']>['admin'] = async ({ req }) => {
  return (await isPlatformBasicUser({ req })) === true
}

const importExportCollectionAccess = {
  create: isPlatformBasicUser,
  read: isPlatformBasicUser,
  update: denyAllCollectionAccess,
  delete: isPlatformBasicUser,
  admin: platformAdminAccess,
} satisfies NonNullable<CollectionConfig['access']>

const publicReadPlatformManagedCollectionAccess = {
  create: isPlatformBasicUser,
  read: anyone,
  update: isPlatformBasicUser,
  delete: isPlatformBasicUser,
  admin: platformAdminAccess,
} satisfies NonNullable<CollectionConfig['access']>

const formSubmissionCollectionAccess = {
  create: anyone,
  read: isPlatformBasicUser,
  update: denyAllCollectionAccess,
  delete: isPlatformBasicUser,
  admin: platformAdminAccess,
} satisfies NonNullable<CollectionConfig['access']>

const searchCollectionAccess = {
  create: denyAllCollectionAccess,
  read: anyone,
  update: isPlatformBasicUser,
  delete: isPlatformBasicUser,
  admin: platformAdminAccess,
} satisfies NonNullable<CollectionConfig['access']>

export const managedPluginCollectionSlugs = [
  'imports',
  'exports',
  'forms',
  'form-submissions',
  'redirects',
  'search',
] as const

export const generatedCollectionAccess = {
  imports: importExportCollectionAccess,
  exports: importExportCollectionAccess,
  forms: publicReadPlatformManagedCollectionAccess,
  'form-submissions': formSubmissionCollectionAccess,
  redirects: publicReadPlatformManagedCollectionAccess,
  search: searchCollectionAccess,
} satisfies Record<(typeof managedPluginCollectionSlugs)[number], NonNullable<CollectionConfig['access']>>

// Keep create absent from the plugin override. The search plugin supplies its own
// fail-closed create rule and treats an explicit override as a user permission
// that must pass before the platform reindex endpoint may run.
export const searchPluginCollectionAccessOverrides = {
  read: searchCollectionAccess.read,
  update: searchCollectionAccess.update,
  delete: searchCollectionAccess.delete,
  admin: searchCollectionAccess.admin,
} satisfies NonNullable<CollectionConfig['access']>

const withPlatformEndpointAccess = (handler: PayloadHandler): PayloadHandler => {
  return async (req) => {
    const allowed = await isPlatformBasicUser({ req })

    if (allowed !== true) {
      return Response.json({ errors: [{ message: 'Forbidden' }] }, { status: 403 })
    }

    return handler(req)
  }
}

export const securePlatformManagedPluginCollection = ({
  collection,
}: {
  collection: CollectionConfig
}): CollectionConfig => {
  return {
    ...collection,
    access: {
      ...collection.access,
      ...importExportCollectionAccess,
    },
    ...(Array.isArray(collection.endpoints)
      ? {
          endpoints: collection.endpoints.map((endpoint) => ({
            ...endpoint,
            handler: withPlatformEndpointAccess(endpoint.handler),
          })),
        }
      : {}),
  }
}
