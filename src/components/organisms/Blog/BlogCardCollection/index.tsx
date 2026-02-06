import React from 'react'

import { Heading } from '@/components/atoms/Heading'
import { BlogCard } from '@/components/organisms/Blog/BlogCard'
import type { BlogCardBaseProps } from '@/utilities/blog/normalizePost'
import { Container } from '@/components/molecules/Container'
import {
  SectionBackground,
  type SectionBackgroundMedia,
  type SectionBackgroundOverlay,
} from '@/components/molecules/SectionBackground'
import { UiLink } from '@/components/molecules/Link'
import { cn } from '@/utilities/ui'

export type BlogCardCollectionProps = {
  posts: BlogCardBaseProps[]
  className?: string
  variant?: 'default' | 'blue'
  title?: string
  intro?: string
  background?: {
    media: SectionBackgroundMedia
    overlay?: SectionBackgroundOverlay
    parallax?: {
      mode?: 'scroll' | 'pointer' | 'both'
      rangePx?: number
      scale?: number
    }
  }
}

/**
 * BlogCardCollection Component
 *
 * Section wrapper for displaying a collection of blog posts.
 * Integrated with SectionBackground for media backgrounds with parallax effects.
 *
 * Features:
 * - Grid layout (3 columns on desktop)
 * - Background image support with overlay/parallax
 * - Blue variant for dark backgrounds
 * - CTA button linking to full blog listing
 *
 * Used on: Homepage blog section
 */
export const BlogCardCollection: React.FC<BlogCardCollectionProps> = ({
  posts = [],
  className,
  variant = 'default',
  title = 'Blog',
  intro,
  background,
}) => {
  const isBlue = variant === 'blue'
  const hasMediaBackground = Boolean(background?.media)

  if (hasMediaBackground) {
    return (
      <SectionBackground
        as="section"
        className={cn('py-20 text-white', isBlue ? 'bg-primary' : 'bg-slate-900')}
        media={background?.media}
        overlay={background?.overlay ?? { kind: 'solid', tone: 'backdrop', opacity: 40 }}
        parallax={background?.parallax}
      >
        <Container>
          <div className="mb-10 flex flex-col gap-4 text-center">
            <Heading as="h2" align="center" className="text-size-56 text-white">
              {title}
            </Heading>
            {intro && <p className="text-lg text-white/80">{intro}</p>}
          </div>
          <div className={className}>
            <div className="grid gap-6 md:grid-cols-3 md:gap-8">
              {posts.map((post) => (
                <BlogCard.Enhanced key={post.href} {...post} variant="dark" />
              ))}
            </div>
          </div>
          <div className="mt-12 flex justify-center">
            <UiLink href="/posts" appearance="ghostWhite" label="More Articles" size="lg" />
          </div>
        </Container>
      </SectionBackground>
    )
  }

  return (
    <section className={cn('py-20', isBlue ? 'bg-primary' : 'bg-white')}>
      <Container>
        <div className="mb-10 flex flex-col gap-4 text-center">
          <Heading as="h2" align="center" className={cn(isBlue ? 'text-white' : 'text-foreground')}>
            {title}
          </Heading>
          {intro && <p className={cn('text-lg', isBlue ? 'text-white/80' : 'text-muted-foreground')}>{intro}</p>}
        </div>
        <div className={className}>
          <div className="grid gap-6 md:grid-cols-3 md:gap-8">
            {posts.map((post) => (
              <BlogCard.Enhanced key={post.href} {...post} variant={isBlue ? 'dark' : 'light'} />
            ))}
          </div>
        </div>
        <div className="mt-12 flex justify-center">
          <UiLink href="/posts" appearance={isBlue ? 'ghostWhite' : 'outline'} label="More Articles" size="lg" />
        </div>
      </Container>
    </section>
  )
}

export default BlogCardCollection
