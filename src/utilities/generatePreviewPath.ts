import { PayloadRequest, CollectionSlug } from 'payload'

/**
 * Maps collection names to their URL prefixes for preview generation.
 */
const collectionPrefixMap: Partial<Record<CollectionSlug, string>> = {
  posts: '/posts',
  pages: '',
}

type Props = {
  collection: keyof typeof collectionPrefixMap
  slug: string
  req: PayloadRequest
}

/**
 * Generates a preview path URL for PayloadCMS content.
 * Creates a Next.js preview URL with encoded parameters for the specified collection and slug.
 *
 * @param params - Preview path generation parameters
 * @param params.collection - Collection name (must be in collectionPrefixMap)
 * @param params.slug - Content slug to preview
 * @param params.req - PayloadCMS request object (currently unused but part of interface)
 * @returns Preview URL string for Next.js preview mode
 *
 * @example
 * generatePreviewPath({ collection: 'posts', slug: 'hello-world', req })
 * // Returns "/next/preview?slug=hello-world&collection=posts&path=/posts/hello-world&previewSecret=..."
 */
export const generatePreviewPath = ({ collection, slug }: Props) => {
  const encodedParams = new URLSearchParams({
    slug,
    collection,
    path: `${collectionPrefixMap[collection]}/${slug}`,
    previewSecret: process.env.PREVIEW_SECRET || '',
  })

  const url = `/next/preview?${encodedParams.toString()}`

  return url
}
