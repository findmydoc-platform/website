import type { Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import {
  buildMediaDescriptorsByOwnerId,
  resolveMediaDescriptorFromLoadedRelation,
  resolveMediaImageDescriptorForOwner,
} from '@/utilities/media/relationMedia'

describe('resolveMediaDescriptorFromLoadedRelation', () => {
  it('prefers relation URL when already present', () => {
    const descriptor = resolveMediaDescriptorFromLoadedRelation(
      {
        id: 10,
        url: '/api/clinicMedia/file/already-present.jpg',
        filename: 'ignored.jpg',
        alt: 'Clinic image',
      },
      'clinicMedia',
    )

    expect(descriptor).toEqual({
      url: '/api/clinicMedia/file/already-present.jpg',
      alt: 'Clinic image',
    })
  })

  it('derives a media URL from filename when relation URL is missing', () => {
    const descriptor = resolveMediaDescriptorFromLoadedRelation(
      {
        id: 11,
        url: null,
        filename: 'derived.jpg',
        alt: 'Derived image',
      },
      'clinicMedia',
    )

    expect(descriptor).toEqual({
      url: '/api/clinicMedia/file/derived.jpg',
      alt: 'Derived image',
    })
  })

  it('builds owner media descriptors from unique relation IDs and loaded relations', async () => {
    const findMock = vi.fn(async (_args: { where: { id: { in: number[] } } }) => ({
      docs: [
        {
          id: 10,
          filename: 'lookup.jpg',
          alt: 'Lookup image',
        },
        {
          id: 11,
          url: '/api/clinicMedia/file/fetched.jpg',
          filename: 'fetched.jpg',
          alt: 'Fetched image',
        },
      ],
      hasNextPage: false,
    }))
    const payload = { find: findMock } as unknown as Payload

    const descriptorsByOwnerId = await buildMediaDescriptorsByOwnerId({
      payload,
      collection: 'clinicMedia',
      items: [
        { id: 1, media: 10 },
        {
          id: 2,
          media: {
            id: 11,
            url: '/api/clinicMedia/file/loaded.jpg',
            filename: 'ignored.jpg',
            alt: 'Loaded image',
          },
        },
        { id: 3, media: null },
        { id: 4, media: 999 },
        { id: 5, media: 10 },
      ],
      getOwnerId: (item) => item.id,
      getRelation: (item) => item.media,
    })

    expect(findMock).toHaveBeenCalledTimes(1)
    expect(findMock.mock.calls[0]?.[0].where.id.in).toEqual([10, 11, 999])
    expect(descriptorsByOwnerId).toEqual(
      new Map([
        [
          1,
          {
            url: '/api/clinicMedia/file/lookup.jpg',
            alt: 'Lookup image',
          },
        ],
        [
          2,
          {
            url: '/api/clinicMedia/file/loaded.jpg',
            alt: 'Loaded image',
          },
        ],
        [
          5,
          {
            url: '/api/clinicMedia/file/lookup.jpg',
            alt: 'Lookup image',
          },
        ],
      ]),
    )
    expect(descriptorsByOwnerId.has(3)).toBe(false)
    expect(descriptorsByOwnerId.has(4)).toBe(false)
  })

  it('resolves owner descriptors with loaded relations taking precedence over lookup maps', () => {
    const descriptorsByOwnerId = new Map([
      [
        1,
        {
          url: '/api/clinicMedia/file/lookup.jpg',
          alt: 'Lookup image',
        },
      ],
      [
        2,
        {
          url: '/api/clinicMedia/file/lookup-loaded.jpg',
          alt: 'Lookup loaded image',
        },
      ],
    ])

    expect(
      resolveMediaImageDescriptorForOwner({
        ownerId: 1,
        relation: 10,
        collection: 'clinicMedia',
        descriptorsByOwnerId,
      }),
    ).toEqual({
      url: '/api/clinicMedia/file/lookup.jpg',
      alt: 'Lookup image',
    })

    expect(
      resolveMediaImageDescriptorForOwner({
        ownerId: 2,
        relation: {
          id: 20,
          url: '/api/clinicMedia/file/loaded.jpg',
          filename: 'ignored.jpg',
          alt: 'Loaded image',
        },
        collection: 'clinicMedia',
        descriptorsByOwnerId,
      }),
    ).toEqual({
      url: '/api/clinicMedia/file/loaded.jpg',
      alt: 'Loaded image',
    })
  })
})
