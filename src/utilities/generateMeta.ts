import type { Metadata } from 'next'

import type { Media, Page, Post, Config } from '../payload-types'

import { mergeOpenGraph } from './mergeOpenGraph'
import { getServerSideURL } from './getURL'

/**
 * Generates an image URL for OpenGraph metadata.
 * Uses the OG-optimized size if available, otherwise falls back to the original image URL.
 * 
 * @param image - Media object, ID, or null/undefined
 * @returns Complete image URL for OpenGraph metadata
 */
const getImageURL = (image?: Media | Config['db']['defaultIDType'] | null) => {
  const serverUrl = getServerSideURL()

  let url = serverUrl + '/website-template-OG.webp'

  if (image && typeof image === 'object' && 'url' in image) {
    const ogUrl = image.sizes?.og?.url

    url = ogUrl ? serverUrl + ogUrl : serverUrl + image.url
  }

  return url
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
 * // Returns { title: "Page Title | Payload Website Template", description: "...", openGraph: {...} }
 */
export const generateMeta = async (args: {
  doc: Partial<Page> | Partial<Post> | null
}): Promise<Metadata> => {
  const { doc } = args

  const ogImage = getImageURL(doc?.meta?.image)

  const title = doc?.meta?.title
    ? doc?.meta?.title + ' | Payload Website Template'
    : 'Payload Website Template'

  return {
    description: doc?.meta?.description,
    openGraph: mergeOpenGraph({
      description: doc?.meta?.description || '',
      images: ogImage
        ? [
            {
              url: ogImage,
            },
          ]
        : undefined,
      title,
      url: Array.isArray(doc?.slug) ? doc?.slug.join('/') : '/',
    }),
    title,
  }
}
