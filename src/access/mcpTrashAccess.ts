import { APIError, type CollectionBeforeOperationHook, type CollectionSlug, type PayloadRequest } from 'payload'
import { AsyncLocalStorage } from 'node:async_hooks'

type TrashTarget = { req: PayloadRequest; collection: 'clinics' | 'doctors'; id: string | number }
const authorizedTrash = new AsyncLocalStorage<TrashTarget>()

export async function withAuthorizedMcpTrash<T>(target: TrashTarget, action: () => Promise<T>): Promise<T> {
  return authorizedTrash.run(target, action)
}

export const guardMcpTrash =
  <T extends CollectionSlug>(collection: 'clinics' | 'doctors'): CollectionBeforeOperationHook<T> =>
  ({ args, operation, req }) => {
    if (req.payloadAPI !== 'MCP' || operation !== 'update') return args
    const input = args as unknown as { data?: unknown; id?: unknown; where?: unknown }
    if (input.data && typeof input.data === 'object' && Object.hasOwn(input.data, 'deletedAt')) {
      const target = authorizedTrash.getStore()
      if (
        !target ||
        target.req !== req ||
        target.collection !== collection ||
        input.id == null ||
        String(input.id) !== String(target.id) ||
        input.where != null
      ) {
        throw new APIError('Use the explicitly authorized trash tool to change deletion state.', 403)
      }
    }
    return args
  }

export const guardMcpClinicGallery: CollectionBeforeOperationHook<'clinics'> = ({ args, operation, req }) => {
  if (req.payloadAPI !== 'MCP' || (operation !== 'create' && operation !== 'update')) return args
  const input = args as unknown as { data?: unknown; overrideAccess?: boolean }
  if (
    !input.overrideAccess &&
    input.data &&
    typeof input.data === 'object' &&
    Object.hasOwn(input.data, 'profileGallery')
  ) {
    throw new APIError('Use the clinic gallery tools to change profile images.', 403)
  }
  return args
}
