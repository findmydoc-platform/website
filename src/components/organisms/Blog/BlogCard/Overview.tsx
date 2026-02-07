import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Calendar, Clock } from 'lucide-react'
import { Heading } from '@/components/atoms/Heading'
import { cn } from '@/utilities/ui'
import type { BlogCardBaseProps } from '@/utilities/blog/normalizePost'

/**
 * Overview variant: Compact card for related posts section (16:10 aspect ratio)
 * Used for: "Related Articles" section at bottom of blog post detail page
 * Visual: Category pill below image, compact layout, meta info with icons
 */
export const Overview: React.FC<BlogCardBaseProps> = ({
  title,
  excerpt,
  href,
  dateLabel,
  readTime,
  category,
  image,
  author,
  className,
}) => {
  const resolvedImage = image ?? { src: '/images/blog-placeholder-1600-900.svg', alt: 'Blog placeholder' }
  const authorAvatar = author?.avatar || '/images/avatar-placeholder.svg'

  return (
    <Link href={href} className={cn('group block', className)}>
      <article className="flex h-full flex-col">
        {/* Image */}
        <div className="relative mb-5 aspect-[16/10] overflow-hidden rounded-xl">
          <Image
            src={resolvedImage.src}
            alt={resolvedImage.alt || 'Blog placeholder'}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        </div>

        {/* Category Pill */}
        {category && (
          <div className="mb-3">
            <span className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary">
              {category}
            </span>
          </div>
        )}

        {/* Title */}
        <Heading
          as="h3"
          size="h5"
          align="left"
          className="mb-2 line-clamp-2 transition-colors group-hover:text-primary"
        >
          {title}
        </Heading>

        {/* Excerpt */}
        {excerpt && <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{excerpt}</p>}

        {/* Author Row */}
        {author && (
          <div className="mt-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-full">
                <Image src={authorAvatar} alt={author.name} fill className="object-cover" />
              </div>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium text-foreground">{author.name}</span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {dateLabel && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {dateLabel}
                    </span>
                  )}
                  {readTime && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {readTime}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 flex-shrink-0 text-muted-foreground transition-all group-hover:translate-x-1 group-hover:text-primary" />
          </div>
        )}
      </article>
    </Link>
  )
}
