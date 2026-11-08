import { APIError, type CollectionBeforeOperationHook, type CollectionSlug, type PayloadRequest } from 'payload'

const authorizedRequests = new WeakSet<PayloadRequest>()

export async function withAuthorizedMcpTrash<T>(req: PayloadRequest, action: () => Promise<T>): Promise<T> {
  authorizedRequests.add(req)
  try {
    return await action()
  } finally {
    authorizedRequests.delete(req)
  }
}

export const guardMcpTrash =
  <T extends CollectionSlug>(): CollectionBeforeOperationHook<T> =>
  ({ args, operation, req }) => {
    if (req.payloadAPI !== 'MCP' || operation !== 'update') return args
    const data = (args as unknown as { data?: unknown }).data
    if (data && typeof data === 'object' && Object.hasOwn(data, 'deletedAt') && !authorizedRequests.has(req)) {
      throw new APIError('Use the explicitly authorized trash tool to change deletion state.', 403)
    }
    return args
  }
