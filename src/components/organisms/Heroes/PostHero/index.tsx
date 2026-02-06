import { formatDateTime } from 'src/utilities/formatDateTime'
import React from 'react'
import Image from 'next/image'
import { Calendar, Clock } from 'lucide-react'

import { Media } from '@/components/molecules/Media'
import { Container } from '@/components/molecules/Container'
import { Breadcrumb, type BreadcrumbItem } from '@/components/molecules/Breadcrumb'
import { Heading } from '@/components/atoms/Heading'
import type { StaticImageData } from 'next/image'

export type PostHeroProps = {
  title: string
  excerpt?: string
  categories?: string[]
  author?: {
    name: string
    role?: string
    avatar?: string
  }
  /** @deprecated Use author.name instead */
  authors?: string
  publishedAt?: string
  readTime?: string
  breadcrumbs?: BreadcrumbItem[]
  image?: {
    src: string | StaticImageData
    alt: string
    width?: number
    height?: number
  }
  overlayOpacity?: number
}

export const PostHero: React.FC<PostHeroProps> = ({
  title,
  excerpt,
  categories,
  author,
  authors, // deprecated
  publishedAt,
  readTime,
  breadcrumbs,
  image,
  overlayOpacity = 42,
}) => {
  // Backward compatibility: use authors if author not provided.
  // Keep a consistent row in the hero even when CMS author data is incomplete.
  const displayAuthor = author || (authors ? { name: authors } : { name: 'findmydoc Editorial Team' })
  const primaryCategory = categories?.[0]
  const authorAvatar = displayAuthor?.avatar || '/images/avatar-placeholder.svg'
  const authorRole = displayAuthor?.role || (author ? 'Author' : 'Editorial Team')
  const resolvedImage = image ?? { src: '/images/blog-placeholder-1600-900.svg', alt: 'Blog placeholder' }
  const clampedOverlayOpacity = Math.max(0, Math.min(100, overlayOpacity))
  const strongOverlay = clampedOverlayOpacity / 100
  const softOverlay = Math.max(strongOverlay * 0.55, 0)
  const midOverlay = Math.max(strongOverlay * 0.3, 0)
  const topOverlay = Math.max(strongOverlay * 0.1, 0)

  return (
    <div className="relative isolate overflow-hidden">
      <div className="absolute inset-0 -z-10 select-none">
        <Media
          fill
          priority
          imgClassName="object-cover"
          src={resolvedImage.src}
          alt={resolvedImage.alt}
          width={resolvedImage.width}
          height={resolvedImage.height}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ backgroundColor: `rgba(0, 0, 0, ${softOverlay})` }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(to top, rgba(0, 0, 0, ${strongOverlay}), rgba(0, 0, 0, ${midOverlay}), rgba(0, 0, 0, ${topOverlay}))`,
          }}
        />
      </div>

      <Container className="relative z-10 flex min-h-[32rem] items-end py-24 text-white md:min-h-[38rem] md:py-28 lg:min-h-[42rem] lg:py-32">
        <div className="grid w-full grid-cols-1 lg:grid-cols-12">
          <div className="text-left lg:col-span-7 lg:col-start-3">
            {/* Breadcrumb Navigation */}
            {breadcrumbs && breadcrumbs.length > 0 && (
              <Breadcrumb items={breadcrumbs} variant="light" className="mb-6" />
            )}

            {/* Category Badge */}
            {primaryCategory && (
              <span className="mb-6 inline-block rounded-full bg-primary px-4 py-1.5 text-sm text-white">
                {primaryCategory}
              </span>
            )}

            {/* Title */}
            <Heading as="h1" size="h1" align="left" variant="white" className="mb-5 max-w-4xl">
              {title}
            </Heading>

            {/* Excerpt */}
            {excerpt && <p className="mb-10 max-w-4xl text-lg text-white/90 md:text-xl">{excerpt}</p>}

            {/* Author & Meta Info */}
            <div className="flex flex-wrap items-center gap-4 md:gap-6">
              {/* Author with Avatar */}
              {displayAuthor && (
                <div className="flex items-center gap-3">
                  <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-full ring-2 ring-white/20">
                    <Image src={authorAvatar} alt={displayAuthor.name} fill className="object-cover" />
                  </div>
                  <div className="flex flex-col">
                    <p className="font-semibold text-white">{displayAuthor.name}</p>
                    {authorRole && <p className="text-sm text-white/70">{authorRole}</p>}
                  </div>
                </div>
              )}

              {/* Date & Read Time */}
              <div className="flex items-center gap-5 text-sm text-white/80">
                {publishedAt && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    <time dateTime={publishedAt}>{formatDateTime(publishedAt)}</time>
                  </div>
                )}
                {readTime && (
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    <span>{readTime}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Container>
    </div>
  )
}
