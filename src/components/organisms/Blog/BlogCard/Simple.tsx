import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Heading } from '@/components/atoms/Heading'
import { cn } from '@/utilities/ui'
import type { BlogCardBaseProps } from '@/utilities/blog/normalizePost'

/**
 * Simple variant: Minimal grid card without avatar (4:3 aspect ratio)
 * Used for: Blog listing grid (paginated posts)
 * Visual: Category badge top-right, vertical stack, author name + date (no avatar)
 */
export const Simple: React.FC<BlogCardBaseProps> = ({
  title,
  excerpt,
  href,
  dateLabel,
  category,
  image,
  author,
  className,
}) => {
  const resolvedImage = image ?? {
    src: '/images/blog-placeholder-1600-900.svg',
    alt: 'Blog placeholder',
    sizes: '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
    quality: 70,
  }
  const imageSizes = resolvedImage.sizes ?? '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw'
  const imageQuality = resolvedImage.quality ?? 70
  const authorName = author?.name || 'findmydoc Editorial Team'

  return (
    <Link
      href={href}
      aria-label={title}
      className={cn(
        'group block rounded-3xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none',
        className,
      )}
    >
      <article className="flex h-full flex-col">
        {/* Image with Category Overlay */}
        <div className="relative mb-4 aspect-[4/3] overflow-hidden rounded-3xl">
          <Image
            src={resolvedImage.src}
            alt=""
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes={imageSizes}
            quality={imageQuality}
          />

          {/* Category Badge - Top Right */}
          {category && (
            <div className="absolute top-3 right-3 left-3 flex justify-end sm:top-4 sm:right-4 sm:left-4">
              <span
                title={category}
                className="line-clamp-2 max-w-full rounded-full bg-white px-2.5 py-1 text-[11px] leading-tight font-semibold break-words text-foreground shadow-sm sm:px-3 sm:text-xs"
              >
                {category}
              </span>
            </div>
          )}
        </div>

        <div className="mb-3 flex min-h-[6.8rem] flex-col">
          {/* Title */}
          <Heading
            as="h3"
            size="h6"
            align="left"
            className="mb-2 line-clamp-2 min-h-[3.5rem] transition-colors group-hover:text-primary"
          >
            {title}
          </Heading>

          {/* Excerpt */}
          <p
            className={cn(
              'line-clamp-2 min-h-[2.9rem] text-sm leading-relaxed text-muted-foreground',
              !excerpt && 'opacity-0',
            )}
            aria-hidden={!excerpt}
          >
            {excerpt || '\u00A0'}
          </p>
        </div>

        {/* Author Name and Date - No Avatar */}
        <div className="mt-auto flex min-h-[2.5rem] min-w-0 flex-col items-start gap-1 border-t border-border/30 pt-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <span className="w-full min-w-0 truncate font-medium text-foreground sm:flex-1 sm:basis-0">{authorName}</span>
          <span
            className={cn(
              'max-w-full truncate text-xs text-muted-foreground sm:ml-3 sm:flex-shrink-0',
              !dateLabel && 'opacity-0',
            )}
            aria-hidden={!dateLabel}
          >
            {dateLabel || '\u00A0'}
          </span>
        </div>
      </article>
    </Link>
  )
}
