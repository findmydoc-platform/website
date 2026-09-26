import config from '@payload-config'
import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => vi.unstubAllEnvs())

it('rejects a hosted process with unbound credentials during Payload initialization', async () => {
  vi.stubEnv('CI', 'false')
  vi.stubEnv('NEXT_PHASE', undefined)
  vi.stubEnv('VERCEL_ENV', 'preview')
  vi.stubEnv('DEPLOYMENT_ENV', 'preview')
  vi.stubEnv('NODE_ENV', 'production')
  const resolved = await config
  if (!resolved.onInit) throw new Error('Expected Payload initialization hook')
  await expect(resolved.onInit({} as Parameters<typeof resolved.onInit>[0])).rejects.toThrow('environment-unavailable')
})
