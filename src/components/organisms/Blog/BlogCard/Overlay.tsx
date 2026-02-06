import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Heading } from '@/components/atoms/Heading'
import { cn } from '@/utilities/ui'
import type { BlogCardBaseProps } from '@/utilities/blog/normalizePost'

/**
 * Overlay variant: Featured card with full-bleed image and gradient overlay (21:9 aspect ratio)
 * Used for: Featured/latest article at top of blog listing page
 * Visual: Category badge top-left, large title over image with gradient, author info at bottom
 */
export const Overlay: React.FC<BlogCardBaseProps> = ({
  title,
  excerpt,
  href,
  dateLabel,
  category,
  image,
  author,
  className,
}) => {
  const resolvedImage = image ?? { src: '/images/blog-placeholder-1600-900.svg', alt: 'Blog placeholder' }
  const authorAvatar = author?.avatar || '/images/avatar-placeholder.svg'
  const authorName = author?.name || 'findmydoc Editorial Team'

  return (
    <Link href={href} className={cn('group block', className)}>
      <article className="relative aspect-[21/9] overflow-hidden rounded-4xl">
        {/* Background Image */}
        <Image
          src={resolvedImage.src}
          alt={resolvedImage.alt || 'Blog placeholder'}
          fill
          className="object-cover transition-transform duration-700 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 1200px"
        />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

        {/* Category Badge - Top Left */}
        {category && (
          <div className="absolute top-6 left-6">
            <span className="inline-block rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-foreground shadow-md">
              {category}
            </span>
          </div>
        )}

        {/* Content Overlay - Bottom */}
        <div className="absolute right-0 bottom-0 left-0 p-6 md:p-8">
          <Heading
            as="h3"
            size="h3"
            align="left"
            variant="white"
            className="mb-3 line-clamp-2 max-w-[80%] transition-colors group-hover:text-white/90"
          >
            {title}
          </Heading>

          {excerpt && (
            <p className="mb-4 line-clamp-2 max-w-[80%] text-sm leading-relaxed text-white/80 md:text-base">
              {excerpt}
            </p>
          )}

          {/* Author Row */}
          <div className="flex items-center gap-4">
            <div className="relative h-10 w-10 overflow-hidden rounded-full ring-2 ring-white/30">
              <Image src={authorAvatar} alt={authorName} fill className="object-cover" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-white">{authorName}</span>
              {dateLabel && <span className="text-xs text-white/60">{dateLabel}</span>}
            </div>
          </div>
        </div>
      </article>
    </Link>
  )
}
