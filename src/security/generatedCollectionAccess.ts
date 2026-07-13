import type { Access, CollectionConfig, PayloadHandler } from 'payload'

import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'

const denyAllCollectionAccess: Access = () => false

const platformAdminAccess: NonNullable<CollectionConfig['access']>['admin'] = async ({ req }) => {
  return (await isPlatformBasicUser({ req })) === true
}

const platformManagedCollectionAccess = {
  create: isPlatformBasicUser,
  read: isPlatformBasicUser,
  update: denyAllCollectionAccess,
  delete: isPlatformBasicUser,
  admin: platformAdminAccess,
} satisfies NonNullable<CollectionConfig['access']>

export const managedPluginCollectionSlugs = ['imports', 'exports'] as const

export const generatedCollectionAccess = {
  imports: platformManagedCollectionAccess,
  exports: platformManagedCollectionAccess,
} satisfies Record<(typeof managedPluginCollectionSlugs)[number], NonNullable<CollectionConfig['access']>>

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
      ...platformManagedCollectionAccess,
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
