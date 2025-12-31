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
  titleClassName?: string
  textClassName?: string
}

export const BlogCard: React.FC<BlogCardProps> = ({
  title,
  excerpt,
  dateLabel,
  image,
  className,
  titleClassName,
  textClassName,
}) => {
  return (
    <div className={cn('flex flex-col', className)}>
      {image && (
        <div className="relative mb-6 h-73 overflow-hidden rounded-3xl">
          <Image
            src={image.src}
            alt={image.alt}
            fill
            className="object-cover transition-transform duration-300 hover:scale-105"
          />
        </div>
      )}
      <h3 className={cn('mb-4 text-3xl font-bold leading-tight text-foreground', titleClassName)}>{title}</h3>
      {dateLabel && <div className={cn('mb-2 text-sm text-muted-foreground', textClassName)}>{dateLabel}</div>}
      {excerpt && <p className={cn('mb-4 text-lg text-muted-foreground', textClassName)}>{excerpt}</p>}
    </div>
  )
}

export default BlogCard
