import type { Metadata } from 'next'

import { DEFAULT_SITE_DESCRIPTION, getDefaultOpenGraphImages, SITE_NAME } from './socialPreview'

/**
 * Default OpenGraph metadata configuration for the website.
 * Provides fallback values when specific metadata is not available.
 */
const defaultOpenGraph: Metadata['openGraph'] = {
  type: 'website',
  description: DEFAULT_SITE_DESCRIPTION,
  images: getDefaultOpenGraphImages(),
  siteName: SITE_NAME,
  title: SITE_NAME,
}

/**
 * Merges custom OpenGraph metadata with default values.
 * Preserves default images if no custom images are provided.
 *
 * @param og - Custom OpenGraph metadata to merge with defaults
 * @returns Merged OpenGraph metadata object
 *
 * @example
 * mergeOpenGraph({ title: 'Custom Title' })
 * // Returns default metadata with custom title
 */
export const mergeOpenGraph = (og?: Metadata['openGraph']): Metadata['openGraph'] => {
  return {
    ...defaultOpenGraph,
    ...og,
    images: og?.images ? og.images : defaultOpenGraph.images,
  }
}
