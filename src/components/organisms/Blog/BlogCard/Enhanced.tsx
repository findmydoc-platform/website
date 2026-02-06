import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
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

  return (
    <Link href={href} className={cn('group block', className)}>
      <article className="flex flex-col">
        {/* Image with Category Overlay */}
        {image && (
          <div className="relative mb-5 aspect-[4/3] overflow-hidden rounded-3xl">
            <Image
              src={image.src}
              alt={image.alt}
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
        )}

        {/* Title */}
        <h3
          className={cn(
            'mb-3 line-clamp-2 text-xl font-bold transition-colors md:text-2xl',
            isDark ? 'text-white group-hover:text-white/80' : 'text-foreground group-hover:text-primary',
          )}
        >
          {title}
        </h3>

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
              {author.avatar && (
                <div
                  className={cn(
                    'relative h-9 w-9 overflow-hidden rounded-full ring-2',
                    isDark ? 'ring-white/20' : 'ring-muted',
                  )}
                >
                  <Image src={author.avatar} alt={author.name} fill className="object-cover" />
                </div>
              )}
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
