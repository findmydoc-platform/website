import React from 'react'

import { BlogCard, type BlogCardProps } from '@/components/organisms/Blog/BlogCard'
import { Container } from '@/components/molecules/Container'
import {
  SectionBackground,
  type SectionBackgroundMedia,
  type SectionBackgroundOverlay,
} from '@/components/molecules/SectionBackground'
import { cn } from '@/utilities/ui'

export type BlogCardCollectionProps = {
  posts: BlogCardProps[]
  className?: string
  variant?: 'default' | 'blue'
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
  background,
}) => {
  const isBlue = variant === 'blue'
  const hasMediaBackground = Boolean(background?.media)

  if (hasMediaBackground) {
    return (
      <SectionBackground
        as="section"
        className={cn('bg-slate-900 py-20 text-white')}
        media={background?.media}
        overlay={background?.overlay ?? { kind: 'solid', tone: 'backdrop', opacity: 40 }}
        parallax={background?.parallax}
      >
        <Container>
          <div className="mb-10 flex flex-col gap-4 text-left">
            <h2 className="text-size-56 font-bold text-white">Blog</h2>
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
        </Container>
      </SectionBackground>
    )
  }

  return (
    <section className={cn('py-20', isBlue ? 'bg-primary' : 'bg-white')}>
      <Container>
        <div className="mb-10 flex flex-col gap-4 text-left">
          <h2 className={cn('text-size-56 font-bold', isBlue ? 'text-white' : 'text-foreground')}>Blog</h2>
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
      </Container>
    </section>
  )
}

export default BlogCardCollection
