import React from 'react'
import Image, { type StaticImageData } from 'next/image'
import { cn } from '@/utilities/ui'

export type BlogCardProps = {
  title: string
  excerpt?: string
  dateLabel?: string
  image?: {
    src: string | StaticImageData
    alt: string
  }
  className?: string
  variant?: 'default' | 'inverted'
}

export const BlogCard: React.FC<BlogCardProps> = ({
  title,
  excerpt,
  dateLabel,
  image,
  className,
  variant = 'default',
}) => {
  const isInverted = variant === 'inverted'

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {image && (
        <div className="relative aspect-[3/2] w-full overflow-hidden rounded-4xl">
          <Image
            src={image.src}
            alt={image.alt}
            fill
            className="object-cover transition-transform duration-300 hover:scale-105"
          />
        </div>
      )}
      <h3 className={cn('text-size-40 text-left font-bold', isInverted ? 'text-white' : 'text-foreground')}>{title}</h3>
      {dateLabel && (
        <div className={cn('text-base leading-normal', isInverted ? 'text-white/80' : 'text-muted-foreground')}>
          {dateLabel}
        </div>
      )}
      {excerpt && (
        <p className={cn('text-base leading-normal', isInverted ? 'text-white/80' : 'text-muted-foreground')}>
          {excerpt}
        </p>
      )}
    </div>
  )
}

export default BlogCard
