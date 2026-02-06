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
  const resolvedImage = image ?? { src: '/images/blog-placeholder-1600-900.svg', alt: 'Blog placeholder' }
  const authorName = author?.name || 'findmydoc Editorial Team'

  return (
    <Link href={href} className={cn('group block', className)}>
      <article className="flex h-full flex-col">
        {/* Image with Category Overlay */}
        <div className="relative mb-4 aspect-[4/3] overflow-hidden rounded-3xl">
          <Image
            src={resolvedImage.src}
            alt={resolvedImage.alt || 'Blog placeholder'}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />

          {/* Category Badge - Top Right */}
          {category && (
            <div className="absolute top-4 right-4">
              <span className="inline-block rounded-full bg-white px-3 py-1 text-xs font-semibold text-foreground shadow-sm">
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
        <div className="mt-auto flex min-h-[2.5rem] items-center justify-between border-t border-border/30 pt-3 text-sm">
          <span className="truncate font-medium text-foreground">{authorName}</span>
          <span
            className={cn('ml-3 flex-shrink-0 text-xs text-muted-foreground', !dateLabel && 'opacity-0')}
            aria-hidden={!dateLabel}
          >
            {dateLabel || '\u00A0'}
          </span>
        </div>
      </article>
    </Link>
  )
}
