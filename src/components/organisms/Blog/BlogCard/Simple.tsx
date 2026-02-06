import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
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

  return (
    <Link href={href} className={cn('group block', className)}>
      <article className="flex flex-col">
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

        {/* Title */}
        <h3 className="mb-2 line-clamp-2 text-lg font-bold text-foreground transition-colors group-hover:text-primary md:text-xl">
          {title}
        </h3>

        {/* Excerpt */}
        {excerpt && <p className="mb-3 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{excerpt}</p>}

        {/* Author Name and Date - No Avatar */}
        {(author || dateLabel) && (
          <div className="mt-auto flex items-center justify-between border-t border-border/30 pt-3 text-sm">
            <span className="font-medium text-foreground">{author?.name}</span>
            {dateLabel && <span className="text-xs text-muted-foreground">{dateLabel}</span>}
          </div>
        )}
      </article>
    </Link>
  )
}
