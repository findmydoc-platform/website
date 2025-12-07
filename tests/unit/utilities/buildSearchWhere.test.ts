import { describe, it, expect, vi } from 'vitest'
import { buildSearchWhere } from '@/utilities/buildSearchWhere'

describe('buildSearchWhere', () => {
  const baseCondition = {
    'doc.relationTo': {
      equals: 'clinics',
    },
  }

  it('returns only the base condition when no filters are provided', async () => {
    const payload = { find: vi.fn() } as any

    const result = await buildSearchWhere({ payload, filters: {} })

    expect(result).toEqual(baseCondition)
    expect(payload.find).not.toHaveBeenCalled()
  })

  it('includes search terms for service and q filters', async () => {
    const payload = { find: vi.fn() } as any

    const result = await buildSearchWhere({
      payload,
      filters: {
        service: ' implants ',
        q: 'clinic',
      },
    })

    expect(result).toEqual({
      and: [
        baseCondition,
        {
          or: [
            { title: { like: 'implants' } },
            { treatmentName: { like: 'implants' } },
            { 'meta.description': { like: 'implants' } },
            { slug: { like: 'implants' } },
          ],
        },
        {
          or: [
            { title: { like: 'clinic' } },
            { treatmentName: { like: 'clinic' } },
            { 'meta.description': { like: 'clinic' } },
            { slug: { like: 'clinic' } },
          ],
        },
      ],
    })
    expect(payload.find).not.toHaveBeenCalled()
  })

  it('adds city and budget filters when provided and valid', async () => {
    const find = vi.fn().mockResolvedValue({ docs: [{ id: 'city-id-123' }] })
    const payload = { find } as any

    const result = await buildSearchWhere({
      payload,
      filters: {
        location: ' Paris ',
        budget: '5000',
      },
    })

    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'cities',
        where: { name: { equals: 'Paris' } },
      }),
    )

    expect(result).toEqual({
      and: [
        baseCondition,
        { city: { equals: 'city-id-123' } },
        {
          or: [{ minPrice: { lte: 5000 } }, { maxPrice: { lte: 5000 } }],
        },
      ],
    })
  })

  it('ignores invalid location or budget inputs gracefully', async () => {
    const find = vi.fn().mockRejectedValue(new Error('lookup failed'))
    const payload = { find } as any

    const result = await buildSearchWhere({
      payload,
      filters: {
        location: 'Unknown City',
        budget: 'abc',
      },
    })

    // Should fall back to just the base condition when extra filters are unusable
    expect(result).toEqual(baseCondition)
  })
})
