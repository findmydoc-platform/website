import { describe, expect, it } from 'vitest'

import { splitRelativeHrefParts, splitUrlHash, splitUrlQuery } from '@/utilities/urlParts'

describe('urlParts', () => {
  it('splits query content only at the first question mark', () => {
    expect(splitUrlQuery('/api/file/image.jpg?note=first?second&lang=de')).toEqual({
      path: '/api/file/image.jpg',
      query: 'note=first?second&lang=de',
    })
  })

  it('splits hash content only at the first hash mark', () => {
    expect(splitUrlHash('/listing-comparison#overview#details')).toEqual({
      pathAndQuery: '/listing-comparison',
      hash: 'overview#details',
    })
  })

  it('splits relative hrefs into pathname, query, and hash parts', () => {
    expect(splitRelativeHrefParts('/listing-comparison?note=first?second#overview#details')).toEqual({
      pathname: '/listing-comparison',
      query: 'note=first?second',
      hash: 'overview#details',
    })
  })

  it('normalizes an empty relative pathname to root', () => {
    expect(splitRelativeHrefParts('?specialty=nose')).toEqual({
      pathname: '/',
      query: 'specialty=nose',
      hash: '',
    })
  })
})
