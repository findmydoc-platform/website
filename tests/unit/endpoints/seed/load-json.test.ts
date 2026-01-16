import { afterEach, describe, expect, it, vi } from 'vitest'

const mockReadFile = vi.hoisted(() => vi.fn())

vi.mock('node:fs/promises', () => ({ readFile: mockReadFile }))

import { loadSeedFile } from '@/endpoints/seed/utils/load-json'

describe('loadSeedFile', () => {
  afterEach(() => {
    mockReadFile.mockReset()
  })

  it('returns parsed records when valid', async () => {
    mockReadFile.mockResolvedValueOnce(
      JSON.stringify([
        { stableId: 'a-1', name: 'one' },
        { stableId: 'a-2', name: 'two' },
      ]),
    )

    const records = await loadSeedFile('baseline', 'sample')

    expect(records).toHaveLength(2)
    expect(records[0]?.stableId).toBe('a-1')
  })

  it('throws when entry is missing stableId', async () => {
    mockReadFile.mockResolvedValueOnce(JSON.stringify([{ name: 'no-stable' }]))

    await expect(loadSeedFile('baseline', 'broken')).rejects.toThrow(/missing stableId/i)
  })

  it('throws on duplicate stableIds', async () => {
    mockReadFile.mockResolvedValueOnce(
      JSON.stringify([
        { stableId: 'dup', name: 'first' },
        { stableId: 'dup', name: 'second' },
      ]),
    )

    await expect(loadSeedFile('demo', 'duplicates')).rejects.toThrow(/duplicate stableId dup/i)
  })

  it('throws when root is not an array', async () => {
    mockReadFile.mockResolvedValueOnce(JSON.stringify({ stableId: 'obj' }))

    await expect(loadSeedFile('baseline', 'not-array')).rejects.toThrow(/must contain a JSON array/i)
  })
})
