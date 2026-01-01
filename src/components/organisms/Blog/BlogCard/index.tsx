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
    <div className={cn('flex flex-col', className)}>
      {image && (
        <div className="relative mb-6 h-72 overflow-hidden rounded-3xl">
          <Image
            src={image.src}
            alt={image.alt}
            fill
            className="object-cover transition-transform duration-300 hover:scale-105"
          />
        </div>
      )}
      <h3 className={cn('mb-4 text-3xl font-bold leading-tight', isInverted ? 'text-white' : 'text-foreground')}>
        {title}
      </h3>
      {dateLabel && (
        <div className={cn('mb-2 text-sm', isInverted ? 'text-white/80' : 'text-muted-foreground')}>{dateLabel}</div>
      )}
      {excerpt && (
        <p className={cn('mb-4 text-lg', isInverted ? 'text-white/80' : 'text-muted-foreground')}>{excerpt}</p>
      )}
    </div>
  )
}

export default BlogCard
