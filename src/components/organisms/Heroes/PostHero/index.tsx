import { formatDateTime } from 'src/utilities/formatDateTime'
import React from 'react'

import { Heading } from '@/components/atoms/Heading'
import { Media } from '@/components/molecules/Media'
import { Container } from '@/components/molecules/Container'
import type { StaticImageData } from 'next/image'

export type PostHeroProps = {
  title: string
  categories?: string[]
  authors?: string
  publishedAt?: string
  image?: {
    src: string | StaticImageData
    alt: string
    width?: number
    height?: number
  }
}

export const PostHero: React.FC<PostHeroProps> = ({ title, categories, authors, publishedAt, image }) => {
  return (
    <div className="relative flex items-end">
      <Container className="relative z-10 pb-8 text-white lg:grid lg:grid-cols-[1fr_48rem_1fr]">
        <div className="col-span-1 col-start-1 md:col-span-2 md:col-start-2">
          <div className="mb-6 text-sm uppercase">
            {categories?.map((category, index) => {
              const isLast = index === categories.length - 1
              return (
                <React.Fragment key={index}>
                  {category}
                  {!isLast && <React.Fragment>, &nbsp;</React.Fragment>}
                </React.Fragment>
              )
            })}
          </div>

          <div className="">
            <Heading as="h1" align="left" size="h1" className="mb-6 text-3xl md:text-5xl lg:text-6xl">
              {title}
            </Heading>
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:gap-16">
            {authors && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <p className="text-sm">Author</p>
                  <p>{authors}</p>
                </div>
              </div>
            )}
            {publishedAt && (
              <div className="flex flex-col gap-2">
                <p className="text-sm">Date Published</p>
                <time dateTime={publishedAt}>{formatDateTime(publishedAt)}</time>
              </div>
            )}
          </div>
        </div>
      </Container>
      <div className="min-h-hero select-none">
        {image && (
          <Media
            fill
            priority
            imgClassName="-z-10 object-cover"
            src={image.src}
            alt={image.alt}
            width={image.width}
            height={image.height}
          />
        )}
        <div className="pointer-events-none absolute bottom-0 left-0 h-1/2 w-full bg-linear-to-t from-black to-transparent" />
      </div>
    </div>
  )
}
