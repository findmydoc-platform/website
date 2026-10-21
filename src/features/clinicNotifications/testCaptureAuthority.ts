import type { PayloadRequest } from 'payload'

const testActivationRequests = new WeakSet<PayloadRequest>()

export function hasTestCaptureAuthority(req: PayloadRequest): boolean {
  return (
    process.env.DEPLOYMENT_ENV === 'test' &&
    (!process.env.VERCEL_ENV || process.env.VERCEL_ENV === 'development') &&
    testActivationRequests.has(req)
  )
}

/** Only the existing test helper uses this request-bound, non-serializable authority. */
export async function withTestCaptureAuthority<T>(req: PayloadRequest, command: () => Promise<T>): Promise<T> {
  if (process.env.DEPLOYMENT_ENV !== 'test' || (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'development'))
    throw new Error('Test capture activation is unavailable.')
  testActivationRequests.add(req)
  try {
    return await command()
  } finally {
    testActivationRequests.delete(req)
  }
}
