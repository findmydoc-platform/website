import React from 'react'

import { BlogCard, type BlogCardProps } from '@/components/organisms/Blog/BlogCard'
import { Heading } from '@/components/atoms/Heading'
import { Container } from '@/components/molecules/Container'
import {
  SectionBackground,
  type SectionBackgroundMedia,
  type SectionBackgroundOverlay,
} from '@/components/molecules/SectionBackground'
import { UiLink } from '@/components/molecules/Link'
import { cn } from '@/utilities/ui'

export type BlogCardCollectionProps = {
  posts: BlogCardProps[]
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
            <div className="grid gap-12 md:grid-cols-3 md:gap-28">
              {posts.map((post, idx) => (
                <BlogCard
                  key={idx}
                  title={post.title}
                  excerpt={post.excerpt}
                  dateLabel={post.dateLabel}
                  image={post.image}
                  variant="inverted"
                />
              ))}
            </div>
          </div>
          <div className="mt-12 flex justify-center">
            <UiLink href="/posts" appearance="ghostWhite" label="More News" size="lg" />
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
          <div className="grid gap-12 md:grid-cols-3 md:gap-28">
            {posts.map((post, idx) => (
              <BlogCard
                key={idx}
                title={post.title}
                excerpt={post.excerpt}
                dateLabel={post.dateLabel}
                image={post.image}
                variant={isBlue ? 'inverted' : 'default'}
              />
            ))}
          </div>
        </div>
        <div className="mt-12 flex justify-center">
          <UiLink href="/posts" appearance="ghostWhite" label="More News" size="lg" />
        </div>
      </Container>
    </section>
  )
}

export default BlogCardCollection
