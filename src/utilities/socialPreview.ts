import type { Metadata } from 'next'

import { getServerSideURL } from './getURL'

export const SITE_NAME = 'findmydoc'

export const DEFAULT_SITE_DESCRIPTION =
  'findmydoc connects international patients with vetted clinics and specialist care.'

export const DEFAULT_SOCIAL_IMAGE_ALT = 'findmydoc clinic discovery platform preview'

export const DEFAULT_OPEN_GRAPH_IMAGE = {
  path: '/findmydoc-og.jpg',
  width: 1200,
  height: 630,
  alt: DEFAULT_SOCIAL_IMAGE_ALT,
}

export const DEFAULT_TWITTER_IMAGE = {
  path: '/findmydoc-og.jpg',
  alt: DEFAULT_SOCIAL_IMAGE_ALT,
}

export type SocialPreviewImage = {
  url: string
  width?: number
  height?: number
  alt?: string
}

export const getAbsoluteSiteURL = (pathOrURL = '/') => {
  if (/^https?:\/\//i.test(pathOrURL)) return pathOrURL

  const normalizedPath = pathOrURL.startsWith('/') ? pathOrURL : `/${pathOrURL}`
  return `${getServerSideURL().replace(/\/+$/, '')}${normalizedPath}`
}

export const formatSiteTitle = (title?: string | null) => {
  const normalizedTitle = title?.trim()

  if (!normalizedTitle) return SITE_NAME
  if (normalizedTitle.includes(SITE_NAME)) return normalizedTitle

  return `${normalizedTitle} | ${SITE_NAME}`
}

export const normalizeSiteDescription = (description?: string | null) => {
  const normalizedDescription = description?.trim()
  return normalizedDescription || DEFAULT_SITE_DESCRIPTION
}

export const getDefaultOpenGraphImages = (): NonNullable<Metadata['openGraph']>['images'] => [
  {
    url: getAbsoluteSiteURL(DEFAULT_OPEN_GRAPH_IMAGE.path),
    width: DEFAULT_OPEN_GRAPH_IMAGE.width,
    height: DEFAULT_OPEN_GRAPH_IMAGE.height,
    alt: DEFAULT_OPEN_GRAPH_IMAGE.alt,
  },
]

export const getOpenGraphImages = (image?: SocialPreviewImage | null): NonNullable<Metadata['openGraph']>['images'] => {
  if (!image) return getDefaultOpenGraphImages()

  return [
    {
      url: getAbsoluteSiteURL(image.url),
      width: image.width ?? DEFAULT_OPEN_GRAPH_IMAGE.width,
      height: image.height ?? DEFAULT_OPEN_GRAPH_IMAGE.height,
      alt: image.alt ?? DEFAULT_SOCIAL_IMAGE_ALT,
    },
  ]
}

export const getTwitterImages = (image?: SocialPreviewImage | null): NonNullable<Metadata['twitter']>['images'] => {
  if (!image) {
    return [
      {
        url: getAbsoluteSiteURL(DEFAULT_TWITTER_IMAGE.path),
        alt: DEFAULT_TWITTER_IMAGE.alt,
      },
    ]
  }

  return [
    {
      url: getAbsoluteSiteURL(image.url),
      alt: image.alt ?? DEFAULT_SOCIAL_IMAGE_ALT,
    },
  ]
}
