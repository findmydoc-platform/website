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

  return (
    <Link href={href} className={cn('group block', className)}>
      <article className="flex flex-col">
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

        {/* Title */}
        <Heading
          as="h3"
          size="h4"
          align="left"
          variant={isDark ? 'white' : 'default'}
          className={cn(
            'mb-3 line-clamp-2 transition-colors',
            isDark ? 'group-hover:text-white/80' : 'group-hover:text-primary',
          )}
        >
          {title}
        </Heading>

        {/* Excerpt */}
        {excerpt && (
          <p
            className={cn(
              'mb-4 line-clamp-2 text-sm leading-relaxed',
              isDark ? 'text-white/70' : 'text-muted-foreground',
            )}
          >
            {excerpt}
          </p>
        )}

        {/* Author Row with Arrow */}
        {author && (
          <div className="mt-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'relative h-9 w-9 overflow-hidden rounded-full ring-2',
                  isDark ? 'ring-white/20' : 'ring-muted',
                )}
              >
                <Image src={authorAvatar} alt={author.name} fill className="object-cover" />
              </div>
              <div className="flex flex-col">
                <span className={cn('text-sm font-medium', isDark ? 'text-white' : 'text-foreground')}>
                  {author.name}
                </span>
                {dateLabel && (
                  <span className={cn('text-xs', isDark ? 'text-white/60' : 'text-muted-foreground')}>{dateLabel}</span>
                )}
              </div>
            </div>
            <ArrowRight
              className={cn(
                'h-5 w-5 transition-all',
                isDark
                  ? 'text-white/60 group-hover:translate-x-1 group-hover:text-white'
                  : 'text-muted-foreground group-hover:translate-x-1 group-hover:text-primary',
              )}
            />
          </div>
        )}
      </article>
    </Link>
  )
}
