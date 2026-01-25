import { describe, expect, it } from 'vitest'

import { createSeedLoader, type SeedFileMap } from '@/endpoints/seed/utils/load-json'

describe('loadSeedFile', () => {
  it('returns parsed records when valid', async () => {
    const map: SeedFileMap = {
      baseline: {
        sample: [
          { stableId: 'a-1', name: 'one' },
          { stableId: 'a-2', name: 'two' },
        ],
      },
      demo: {},
    }

    const { loadSeedFile } = createSeedLoader(map)
    const records = await loadSeedFile('baseline', 'sample')

    expect(records).toHaveLength(2)
    expect(records[0]?.stableId).toBe('a-1')
  })

  it('throws when entry is missing stableId', async () => {
    const map: SeedFileMap = {
      baseline: {
        broken: [{ name: 'no-stable' }],
      },
      demo: {},
    }

    const { loadSeedFile } = createSeedLoader(map)
    await expect(loadSeedFile('baseline', 'broken')).rejects.toThrow(/missing stableId/i)
  })

  it('throws on duplicate stableIds', async () => {
    const map: SeedFileMap = {
      baseline: {},
      demo: {
        duplicates: [
          { stableId: 'dup', name: 'first' },
          { stableId: 'dup', name: 'second' },
        ],
      },
    }

    const { loadSeedFile } = createSeedLoader(map)
    await expect(loadSeedFile('demo', 'duplicates')).rejects.toThrow(/duplicate stableId dup/i)
  })

  it('throws when root is not an array', async () => {
    const map: SeedFileMap = {
      baseline: {
        'not-array': { stableId: 'obj' },
      },
      demo: {},
    }

    const { loadSeedFile } = createSeedLoader(map)
    await expect(loadSeedFile('baseline', 'not-array')).rejects.toThrow(/must contain a JSON array/i)
  })
})
