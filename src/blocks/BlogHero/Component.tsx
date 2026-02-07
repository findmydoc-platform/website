import React from 'react'

import type { BlogHeroBlock as BlogHeroBlockProps } from '@/payload-types'

import { BlogHero } from '@/components/organisms/Blog/BlogHero'

/**
 * BlogHero Block Component
 *
 * CMS adapter for BlogHero organism.
 * Maps Payload block data to presentational props.
 *
 * Used on: Blog listing page
 */
export const BlogHeroBlock: React.FC<BlogHeroBlockProps> = ({ title, subtitle }) => {
  return <BlogHero title={title ?? undefined} subtitle={subtitle ?? undefined} />
}
