import type { CollectionBeforeChangeHook } from 'payload'

export const populatePublishedAt: CollectionBeforeChangeHook = ({ data, operation, req }) => {
  if (operation === 'update' && data?._status === 'published' && !data?.publishedAt) {
    req.payload.logger.info('Auto-populating publishedAt for Page')
    return {
      ...data,
      publishedAt: new Date().toISOString(),
    }
  }

  return data
}
