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
            <h2 className="text-size-56 font-bold text-white">{title}</h2>
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
        </Container>
      </SectionBackground>
    )
  }

  return (
    <section className={cn('py-20', isBlue ? 'bg-primary' : 'bg-white')}>
      <Container>
        <div className="mb-10 flex flex-col gap-4 text-center">
          <h2 className={cn('text-size-56 font-bold', isBlue ? 'text-white' : 'text-foreground')}>{title}</h2>
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
      </Container>
    </section>
  )
}

export default BlogCardCollection
