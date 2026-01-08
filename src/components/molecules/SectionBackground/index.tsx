import React, { useId } from 'react'
import type { StaticImageData } from 'next/image'

import { Media } from '@/components/molecules/Media'
import { cn } from '@/utilities/ui'

import { SectionBackgroundParallax, type SectionBackgroundParallaxProps } from './SectionBackgroundParallax.client'

export type SectionBackgroundMedia = {
  src: string | StaticImageData
  alt: string
  width?: number
  height?: number
  imgClassName?: string
  priority?: boolean
}

export type SectionBackgroundOverlay =
  | {
      kind: 'none'
    }
  | {
      kind: 'solid'
      tone: 'backdrop' | 'primary' | 'secondary' | 'background'
      opacity: 10 | 20 | 30 | 40 | 50 | 60 | 70 | 80 | 90
    }
  | {
      kind: 'custom'
      className: string
    }

export type SectionBackgroundProps = {
  as?: 'div' | 'section'
  className?: string
  contentClassName?: string
  children: React.ReactNode
  media?: SectionBackgroundMedia
  overlay?: SectionBackgroundOverlay
  parallax?: Omit<SectionBackgroundParallaxProps, 'targetId'>
}

const overlayClasses = (overlay: SectionBackgroundOverlay | undefined): string | null => {
  if (!overlay || overlay.kind === 'none') return null

  if (overlay.kind === 'custom') return overlay.className

  const { opacity, tone } = overlay

  switch (tone) {
    case 'backdrop':
      switch (opacity) {
        case 10:
          return 'bg-backdrop/10'
        case 20:
          return 'bg-backdrop/20'
        case 30:
          return 'bg-backdrop/30'
        case 40:
          return 'bg-backdrop/40'
        case 50:
          return 'bg-backdrop/50'
        case 60:
          return 'bg-backdrop/60'
        case 70:
          return 'bg-backdrop/70'
        case 80:
          return 'bg-backdrop/80'
        case 90:
          return 'bg-backdrop/90'
        default: {
          const _exhaustive: never = opacity
          return _exhaustive
        }
      }
    case 'primary':
      switch (opacity) {
        case 10:
          return 'bg-primary/10'
        case 20:
          return 'bg-primary/20'
        case 30:
          return 'bg-primary/30'
        case 40:
          return 'bg-primary/40'
        case 50:
          return 'bg-primary/50'
        case 60:
          return 'bg-primary/60'
        case 70:
          return 'bg-primary/70'
        case 80:
          return 'bg-primary/80'
        case 90:
          return 'bg-primary/90'
        default: {
          const _exhaustive: never = opacity
          return _exhaustive
        }
      }
    case 'secondary':
      switch (opacity) {
        case 10:
          return 'bg-secondary/10'
        case 20:
          return 'bg-secondary/20'
        case 30:
          return 'bg-secondary/30'
        case 40:
          return 'bg-secondary/40'
        case 50:
          return 'bg-secondary/50'
        case 60:
          return 'bg-secondary/60'
        case 70:
          return 'bg-secondary/70'
        case 80:
          return 'bg-secondary/80'
        case 90:
          return 'bg-secondary/90'
        default: {
          const _exhaustive: never = opacity
          return _exhaustive
        }
      }
    case 'background':
      switch (opacity) {
        case 10:
          return 'bg-background/10'
        case 20:
          return 'bg-background/20'
        case 30:
          return 'bg-background/30'
        case 40:
          return 'bg-background/40'
        case 50:
          return 'bg-background/50'
        case 60:
          return 'bg-background/60'
        case 70:
          return 'bg-background/70'
        case 80:
          return 'bg-background/80'
        case 90:
          return 'bg-background/90'
        default: {
          const _exhaustive: never = opacity
          return _exhaustive
        }
      }
    default: {
      const _exhaustive: never = tone
      return _exhaustive
    }
  }
}

export const SectionBackground: React.FC<SectionBackgroundProps> = ({
  as = 'div',
  className,
  contentClassName,
  children,
  media,
  overlay,
  parallax,
}) => {
  const id = useId()
  const Tag = as

  const overlayClassName = overlayClasses(overlay)
  const hasParallax = Boolean(parallax)

  return (
    <Tag className={cn('relative overflow-hidden', className)} data-section-background-root={id}>
      {(media || overlayClassName || hasParallax) && (
        <div
          className={cn(
            'pointer-events-none absolute inset-0 select-none',
            hasParallax &&
              'translate-x-(--fmd-section-bg-x) translate-y-(--fmd-section-bg-y) scale-(--fmd-section-bg-scale) transform-gpu will-change-transform',
          )}
          data-section-background-media={id}
        >
          {media && (
            <Media
              fill
              priority={media.priority}
              imgClassName={cn('object-cover', media.imgClassName)}
              src={media.src}
              alt={media.alt}
              width={media.width}
              height={media.height}
            />
          )}

          {overlayClassName && <div className={cn('absolute inset-0', overlayClassName)} />}
        </div>
      )}

      {hasParallax && <SectionBackgroundParallax targetId={id} {...parallax} />}

      <div className={cn('relative z-10', contentClassName)}>{children}</div>
    </Tag>
  )
}
