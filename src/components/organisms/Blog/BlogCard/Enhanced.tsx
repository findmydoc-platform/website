import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Heading } from '@/components/atoms/Heading'
import { cn } from '@/utilities/ui'
import type { BlogCardBaseProps } from '@/utilities/blog/normalizePost'

export type EnhancedVariant = 'light' | 'dark'

export type EnhancedProps = BlogCardBaseProps & {
  variant?: EnhancedVariant
}

/**
 * Enhanced variant: Homepage card with author avatar and arrow indicator (4:3 aspect ratio)
 * Used for: Homepage blog section (on blue background) or alternative blog grids
 * Visual: Category badge, author avatar with ring, arrow animates on hover
 * Variants: 'light' for white backgrounds, 'dark' for blue/dark backgrounds
 */
export const Enhanced: React.FC<EnhancedProps> = ({
  title,
  excerpt,
  href,
  dateLabel,
  category,
  image,
  author,
  variant = 'dark',
  className,
}) => {
  const isDark = variant === 'dark'
  const resolvedImage = image ?? { src: '/images/blog-placeholder-1600-900.svg', alt: 'Blog placeholder' }
  const authorAvatar = author?.avatar || '/images/avatar-placeholder.svg'
  const authorName = author?.name || 'findmydoc Editorial Team'

  return (
    <Link href={href} className={cn('group block', className)}>
      <article className="flex h-full flex-col">
        {/* Image with Category Overlay */}
        <div className="relative mb-5 aspect-[4/3] overflow-hidden rounded-3xl">
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
              <span className="inline-block rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-foreground shadow-md">
                {category}
              </span>
            </div>
          )}
        </div>

        <div className="mb-4 flex min-h-[7.25rem] flex-col">
          {/* Title */}
          <Heading
            as="h3"
            size="h5"
            align="left"
            variant={isDark ? 'white' : 'default'}
            className={cn(
              'mb-3 line-clamp-2 min-h-[4rem] transition-colors',
              isDark ? 'group-hover:text-white/80' : 'group-hover:text-primary',
            )}
          >
            {title}
          </Heading>

          {/* Excerpt */}
          <p
            className={cn(
              'line-clamp-2 min-h-[2.9rem] text-sm leading-relaxed',
              isDark ? 'text-white/70' : 'text-muted-foreground',
              !excerpt && 'opacity-0',
            )}
            aria-hidden={!excerpt}
          >
            {excerpt || '\u00A0'}
          </p>
        </div>

        {/* Author Card with Arrow */}
        <div className="mt-auto flex items-center justify-between gap-3">
          <div
            className={cn(
              'inline-flex min-w-0 items-center gap-3 rounded-full px-2 py-1',
              isDark ? 'border border-white/15 bg-white/10 backdrop-blur-sm' : '',
            )}
          >
            <div
              className={cn(
                'relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-full ring-2',
                isDark ? 'ring-white/20' : 'ring-muted',
              )}
            >
              <Image src={authorAvatar} alt={authorName} fill className="object-cover" />
            </div>
            <div className="min-w-0">
              <p className={cn('truncate text-sm font-medium', isDark ? 'text-white' : 'text-foreground')}>
                {authorName}
              </p>
              {dateLabel && (
                <p className={cn('truncate text-xs', isDark ? 'text-white/70' : 'text-muted-foreground')}>
                  {dateLabel}
                </p>
              )}
            </div>
          </div>

          <ArrowRight
            className={cn(
              'h-5 w-5 flex-shrink-0 transition-all duration-200 ease-out group-hover:translate-x-1',
              isDark ? 'text-white/70 group-hover:text-white' : 'text-muted-foreground group-hover:text-primary',
            )}
          />
        </div>
      </article>
    </Link>
  )
}
