import type { Config } from 'payload'
import { describe, expect, test } from 'vitest'

import { ClinicStaff } from '@/collections/ClinicStaff'
import { Patients } from '@/collections/Patients'
import { PlatformStaff } from '@/collections/PlatformStaff'
import { createMcpPlugin } from '@/plugins/mcp'

const authCollections = [
  ['patients', Patients],
  ['clinicStaff', ClinicStaff],
  ['platformStaff', PlatformStaff],
] as const

describe('authentication collection unlock access', () => {
  test.each(authCollections)('%s fails closed for authenticated callers', (_slug, collection) => {
    const unlock = collection.access?.unlock

    expect(typeof unlock).toBe('function')
    expect(
      unlock?.({
        req: { user: { collection: 'platformStaff', id: 1 } },
      } as never),
    ).toBe(false)
  })

  test('fails closed for the plugin-generated MCP API key collection', async () => {
    const config = await createMcpPlugin()({ collections: [] } as unknown as Config)
    const collection = config.collections?.find(({ slug }) => slug === 'payload-mcp-api-keys')

    expect(collection).toBeDefined()

    const unlock = collection?.access?.unlock

    expect(typeof unlock).toBe('function')
    expect(
      unlock?.({
        req: { user: { collection: 'platformStaff', id: 1 } },
      } as never),
    ).toBe(false)
  })
})
