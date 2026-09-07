import type { Access, CollectionConfig, PayloadHandler } from 'payload'

import { anyone } from '@/access/anyone'
import { isPlatformStaff } from '@/access/isPlatformStaff'

const denyAllCollectionAccess: Access = () => false

const platformAdminAccess: NonNullable<CollectionConfig['access']>['admin'] = async ({ req }) => {
  return (await isPlatformStaff({ req })) === true
}

const importExportCollectionAccess = {
  create: isPlatformStaff,
  read: isPlatformStaff,
  update: denyAllCollectionAccess,
  delete: isPlatformStaff,
  admin: platformAdminAccess,
} satisfies NonNullable<CollectionConfig['access']>

const publicReadPlatformManagedCollectionAccess = {
  create: isPlatformStaff,
  read: anyone,
  update: isPlatformStaff,
  delete: isPlatformStaff,
  admin: platformAdminAccess,
} satisfies NonNullable<CollectionConfig['access']>

const formSubmissionCollectionAccess = {
  create: anyone,
  read: isPlatformStaff,
  update: denyAllCollectionAccess,
  delete: isPlatformStaff,
  admin: platformAdminAccess,
} satisfies NonNullable<CollectionConfig['access']>

export const managedPluginCollectionSlugs = ['imports', 'exports', 'forms', 'form-submissions', 'redirects'] as const

export const generatedCollectionAccess = {
  imports: importExportCollectionAccess,
  exports: importExportCollectionAccess,
  forms: publicReadPlatformManagedCollectionAccess,
  'form-submissions': formSubmissionCollectionAccess,
  redirects: publicReadPlatformManagedCollectionAccess,
} satisfies Record<(typeof managedPluginCollectionSlugs)[number], NonNullable<CollectionConfig['access']>>

const withPlatformEndpointAccess = (handler: PayloadHandler): PayloadHandler => {
  return async (req) => {
    const allowed = await isPlatformStaff({ req })

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
