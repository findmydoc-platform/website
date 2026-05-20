import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Heading } from '@/components/atoms/Heading'
import { FallbackImage } from '@/components/atoms/FallbackImage'
import { resolveAvatarPlaceholder } from '@/utilities/placeholders/avatar'
import { cn } from '@/utilities/ui'
import type { BlogCardBaseProps } from '@/utilities/blog/normalizePost'

export type OverlayProps = BlogCardBaseProps & {
  overlayOpacity?: number
}

/**
 * Overlay variant: Featured card with full-bleed image and gradient overlay (21:9 aspect ratio)
 * Used for: Featured/latest article at top of blog listing page
 * Visual: Category badge top-left, large title over image with gradient, author info at bottom
 */
export const Overlay: React.FC<OverlayProps> = ({
  title,
  excerpt,
  href,
  dateLabel,
  category,
  image,
  author,
  overlayOpacity = 80,
  className,
}) => {
  const resolvedImage = image ?? {
    src: '/images/blog-placeholder-1600-900.svg',
    alt: 'Blog placeholder',
    sizes: '(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 1200px',
    quality: 70,
  }
  const imageSizes = resolvedImage.sizes ?? '(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 1200px'
  const imageQuality = resolvedImage.quality ?? 70
  const avatarFallback = resolveAvatarPlaceholder({
    persona: 'patient',
  })
  const authorAvatar = author?.avatar || avatarFallback
  const authorName = author?.name || 'findmydoc Editorial Team'
  const clampedOpacity = Math.max(0, Math.min(100, overlayOpacity))
  const fromOpacity = clampedOpacity / 100
  const viaOpacity = Math.max(fromOpacity - 0.4, 0)

  return (
    <Link
      href={href}
      aria-label={title}
      className={cn(
        'group block rounded-3xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none sm:rounded-4xl',
        className,
      )}
    >
      <article className="relative overflow-hidden rounded-3xl border border-border/50 bg-card shadow-sm ring-1 ring-black/5 sm:aspect-[21/9] sm:rounded-4xl sm:border-0 sm:bg-transparent sm:shadow-none sm:ring-0">
        <div className="relative aspect-[16/10] overflow-hidden sm:absolute sm:inset-0 sm:aspect-auto">
          <Image
            src={resolvedImage.src}
            alt=""
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            sizes={imageSizes}
            quality={imageQuality}
            priority
          />

          <div
            className="absolute inset-0 hidden sm:block"
            style={{
              backgroundImage: `linear-gradient(to top, rgba(0,0,0,${fromOpacity}), rgba(0,0,0,${viaOpacity}), rgba(0,0,0,0))`,
            }}
          />

          {category && (
            <div className="absolute top-3 right-3 left-3 sm:top-6 sm:right-auto sm:left-6">
              <span
                title={category}
                className="line-clamp-2 max-w-full rounded-full bg-white px-3 py-1 text-[11px] leading-tight font-semibold break-words text-foreground shadow-md sm:px-4 sm:py-1.5 sm:text-xs"
              >
                {category}
              </span>
            </div>
          )}
        </div>

        <div className="p-4 sm:absolute sm:right-0 sm:bottom-0 sm:left-0 sm:px-6 sm:pt-6 sm:pb-4 md:p-8">
          <Heading
            as="h3"
            size="h3"
            align="left"
            className="mb-2 line-clamp-3 text-xl leading-tight transition-colors group-hover:text-primary sm:mb-3 sm:line-clamp-2 sm:max-w-[80%] sm:text-2xl sm:text-white sm:group-hover:text-white/90 md:text-3xl lg:text-4xl"
          >
            {title}
          </Heading>

          {excerpt && (
            <p className="mb-4 line-clamp-3 text-sm leading-relaxed text-foreground/75 sm:line-clamp-2 sm:max-w-[80%] sm:text-white/80 md:text-base">
              {excerpt}
            </p>
          )}

          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <div className="relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-full ring-2 ring-border/40 sm:h-10 sm:w-10 sm:ring-white/30">
              <FallbackImage
                src={authorAvatar}
                fallbackSrc={avatarFallback}
                alt=""
                fill
                sizes="40px"
                className="object-cover"
              />
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium text-foreground sm:text-white">{authorName}</span>
              {dateLabel && <span className="truncate text-xs text-foreground/70 sm:text-white/60">{dateLabel}</span>}
            </div>
          </div>
        </div>
      </article>
    </Link>
  )
}
