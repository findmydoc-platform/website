import { formatDateTime } from 'src/utilities/formatDateTime'
import React from 'react'
import Image from 'next/image'
import { Calendar, Clock } from 'lucide-react'

import { Heading } from '@/components/atoms/Heading'
import { Media } from '@/components/molecules/Media'
import { Container } from '@/components/molecules/Container'
import { Breadcrumb, type BreadcrumbItem } from '@/components/molecules/Breadcrumb'
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
}) => {
  // Backward compatibility: use authors if author not provided
  const displayAuthor = author || (authors ? { name: authors } : undefined)
  const primaryCategory = categories?.[0]

  return (
    <div className="relative flex items-end">
      <Container className="relative z-10 pb-8 text-white lg:grid lg:grid-cols-[1fr_48rem_1fr]">
        <div className="col-span-1 col-start-1 md:col-span-2 md:col-start-2">
          {/* Breadcrumb Navigation */}
          {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumb items={breadcrumbs} variant="light" className="mb-4" />}

          {/* Category Badge */}
          {primaryCategory && (
            <span className="mb-6 inline-block rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white">
              {primaryCategory}
            </span>
          )}

          {/* Title */}
          <div className="">
            <Heading as="h1" align="left" size="h1" className="mb-6 text-3xl md:text-5xl lg:text-6xl">
              {title}
            </Heading>
          </div>

          {/* Excerpt */}
          {excerpt && <p className="mb-8 text-lg text-white/90 md:text-xl">{excerpt}</p>}

          {/* Author & Meta Info */}
          <div className="flex flex-wrap items-center gap-4 md:gap-6">
            {/* Author with Avatar */}
            {displayAuthor && (
              <div className="flex items-center gap-3">
                {displayAuthor.avatar && (
                  <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-full ring-2 ring-white/20">
                    <Image src={displayAuthor.avatar} alt={displayAuthor.name} fill className="object-cover" />
                  </div>
                )}
                <div className="flex flex-col">
                  <p className="font-semibold text-white">{displayAuthor.name}</p>
                  {displayAuthor.role && <p className="text-sm text-white/70">{displayAuthor.role}</p>}
                </div>
              </div>
            )}

            {/* Date & Read Time */}
            <div className="flex items-center gap-4 text-sm text-white/80">
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
      </Container>
      <div className="min-h-hero select-none">
        {image && (
          <Media
            fill
            priority
            imgClassName="-z-10 object-cover"
            src={image.src}
            alt={image.alt}
            width={image.width}
            height={image.height}
          />
        )}
        <div className="pointer-events-none absolute bottom-0 left-0 h-1/2 w-full bg-linear-to-t from-black to-transparent" />
      </div>
    </div>
  )
}
