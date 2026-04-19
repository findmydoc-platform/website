import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PayloadRequest } from 'payload'
import { populateAuthors } from '@/collections/Posts/hooks/populateAuthors'
import { resolveMediaDescriptorFromRelation } from '@/utilities/media/relationMedia'

vi.mock('@/utilities/media/relationMedia', () => ({
  resolveMediaDescriptorFromRelation: vi.fn(),
}))

const mockedResolveMediaDescriptorFromRelation = vi.mocked(resolveMediaDescriptorFromRelation)

type PopulatedAuthor = {
  id: string
  name: string
  avatar?: string
}

type PostDoc = {
  id: string
  title?: string
  authors?: Array<string | { id?: string }>
  populatedAuthors?: PopulatedAuthor[]
}

const createReq = () => {
  const payload = {
    findByID: vi.fn(),
  }

  return {
    payload,
    req: {
      payload,
      context: {},
    } as unknown as PayloadRequest,
  }
}

describe('populateAuthors', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('hydrates authors via fallback post lookup and maps safe author metadata', async () => {
    const { payload, req } = createReq()
    payload.findByID
      .mockResolvedValueOnce({ id: 'post-1', authors: ['author-1', 'author-2'] })
      .mockResolvedValueOnce({
        id: 'author-1',
        firstName: 'Ada',
        lastName: 'Lovelace',
        profileImage: 'media-1',
      })
      .mockResolvedValueOnce({
        id: 'author-2',
        firstName: 'Grace',
        lastName: '',
        profileImage: null,
      })
    mockedResolveMediaDescriptorFromRelation
      .mockResolvedValueOnce({ url: '/ada.png' } as never)
      .mockResolvedValueOnce(null as never)

    const doc: PostDoc = {
      id: 'post-1',
      title: 'Coverage post',
    }

    const result = await populateAuthors({ collection: {} as never, context: {}, doc, req })

    expect(result).toBe(doc)
    expect(payload.findByID).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        collection: 'posts',
        id: 'post-1',
        depth: 0,
        overrideAccess: true,
        context: { skipPopulateAuthorsFallback: true },
      }),
    )
    expect(doc.populatedAuthors).toEqual([
      { id: 'author-1', name: 'Ada Lovelace', avatar: '/ada.png' },
      { id: 'author-2', name: 'Grace', avatar: undefined },
    ])
  })

  it('ignores stale relations and keeps fallback defaults when author enrichment fails', async () => {
    const { payload, req } = createReq()
    payload.findByID
      .mockResolvedValueOnce({
        id: 'author-1',
        firstName: '  ',
        lastName: '  ',
        profileImage: 'media-1',
      })
      .mockRejectedValueOnce(new Error('missing author'))
    mockedResolveMediaDescriptorFromRelation.mockRejectedValueOnce(new Error('missing media'))

    const doc: PostDoc = {
      id: 'post-2',
      authors: ['author-1', 'author-2'],
    }

    await populateAuthors({ collection: {} as never, context: {}, doc, req })

    expect(doc.populatedAuthors).toEqual([{ id: 'author-1', name: 'Unknown Author', avatar: undefined }])
  })

  it('returns an empty projection when no authors exist and fallback is disabled', async () => {
    const { payload, req } = createReq()
    req.context = { skipPopulateAuthorsFallback: true }
    const doc: PostDoc = {
      id: 'post-3',
      authors: [],
    }

    await populateAuthors({ collection: {} as never, context: {}, doc, req })

    expect(doc.populatedAuthors).toEqual([])
    expect(payload.findByID).not.toHaveBeenCalled()
  })
})
