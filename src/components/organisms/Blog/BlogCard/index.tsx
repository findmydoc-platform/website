import React from 'react'
import Image, { type StaticImageData } from 'next/image'

export type BlogCardProps = {
  title: string
  excerpt?: string
  dateLabel?: string
  image?: {
    src: string | StaticImageData
    alt: string
  }
}

export const BlogCard: React.FC<BlogCardProps> = ({ title, excerpt, dateLabel, image }) => {
  return (
    <div className="flex flex-col">
      {image && (
        <div className="relative mb-6 h-[18.25rem] overflow-hidden rounded-3xl">
          <Image
            src={image.src}
            alt={image.alt}
            fill
            className="object-cover transition-transform duration-300 hover:scale-105"
          />
        </div>
      )}
      <h3 className="mb-4 text-3xl font-bold leading-tight text-foreground">{title}</h3>
      {dateLabel && <div className="mb-2 text-sm text-muted-foreground">{dateLabel}</div>}
      {excerpt && <p className="mb-4 text-lg text-muted-foreground">{excerpt}</p>}
    </div>
  )
}

export default BlogCard
