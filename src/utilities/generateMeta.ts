import type { Metadata } from 'next'

import type { PlatformContentMedia, Page, Post, Config } from '../payload-types'

import { mergeOpenGraph } from './mergeOpenGraph'
import {
  formatSiteTitle,
  getAbsoluteSiteURL,
  getOpenGraphImages,
  getTwitterImages,
  normalizeSiteDescription,
  type SocialPreviewImage,
} from './socialPreview'

/**
 * Generates an image URL for OpenGraph metadata.
 * Uses the OG-optimized size if available, otherwise falls back to the original image URL.
 *
 * @param image - Media object, ID, or null/undefined
 * @returns Complete image URL for OpenGraph metadata
 */
const getImageURL = (image?: PlatformContentMedia | Config['db']['defaultIDType'] | null) => {
  if (image && typeof image === 'object' && 'url' in image) {
    const ogUrl = image.sizes?.og?.url
    const imageUrl = ogUrl ?? image.url

    return imageUrl ? getAbsoluteSiteURL(imageUrl) : null
  }

  return null
}

export const createSiteMetadata = (
  args: {
    title?: string | null
    description?: string | null
    path?: string
    image?: SocialPreviewImage | null
  } = {},
): Metadata => {
  const title = formatSiteTitle(args.title)
  const description = normalizeSiteDescription(args.description)
  const images = getOpenGraphImages(args.image)

  return {
    title,
    description,
    openGraph: mergeOpenGraph({
      title,
      description,
      url: getAbsoluteSiteURL(args.path ?? '/'),
      images,
    }),
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: getTwitterImages(args.image),
    },
  }
}

/**
 * Generates Next.js metadata for pages and posts.
 * Creates SEO-optimized metadata including title, description, and OpenGraph tags.
 *
 * @param args - Metadata generation arguments
 * @param args.doc - Page or Post document with meta fields
 * @returns Next.js Metadata object for the document
 *
 * @example
 * const metadata = await generateMeta({ doc: pageDoc })
 * // Returns { title: "Page Title | findmydoc", description: "...", openGraph: {...} }
 */
export const generateMeta = async (args: {
  doc: Partial<Page> | Partial<Post> | null
  path?: string
}): Promise<Metadata> => {
  const { doc } = args

  const ogImage = getImageURL(doc?.meta?.image)

  const rawSlug: unknown = doc?.slug
  const slugPath =
    typeof rawSlug === 'string'
      ? `/${rawSlug.replace(/^\/+/, '')}`
      : Array.isArray(rawSlug)
        ? `/${rawSlug.filter((segment): segment is string => typeof segment === 'string' && segment.length > 0).join('/')}`
        : '/'

  return createSiteMetadata({
    title: doc?.meta?.title,
    description: doc?.meta?.description,
    path: args.path ?? slugPath,
    image: ogImage ? { url: ogImage } : null,
  })
}
