import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/utilities/ui'
import { Container } from '@/components/molecules/Container'

export type ColSize = 'full' | 'half' | 'oneThird' | 'twoThirds'

export type ContentImage = {
  src?: string
  width?: number
  height?: number
  alt?: string
}

export type ContentColumn = {
  link?: {
    href: string
    label?: string | null
    newTab?: boolean
  }
  richText?: React.ReactNode
  size?: ColSize
  image?: ContentImage | null
  imagePosition?: 'top' | 'bottom' | 'left' | 'right'
  imageSize?: 'content' | 'wide' | 'full'
  caption?: string | null
}

export type ContentProps = {
  columns?: ContentColumn[]
  className?: string
}

const spanBySize: Record<ColSize, string> = {
  full: 'col-span-4 lg:col-span-12',
  half: 'col-span-4 lg:col-span-6',
  oneThird: 'col-span-4 lg:col-span-4',
  twoThirds: 'col-span-4 lg:col-span-8',
}

export const Content: React.FC<ContentProps> = ({ columns, className }) => {
  return (
    <Container className={cn('my-12', className)}>
      <div className="grid grid-cols-4 gap-x-12 gap-y-8 lg:grid-cols-12 lg:gap-x-16">
        {columns?.length
          ? columns.map((col, index) => {
              const { link, richText, size, image, imagePosition = 'top', imageSize = 'content', caption } = col || {}

              const sizeKey: ColSize = (size ?? 'oneThird') as ColSize
              const src = image?.src
              const width = image?.width
              const height = image?.height
              const alt = image?.alt ?? ''

              const wrapClass =
                imagePosition === 'left' || imagePosition === 'right'
                  ? cn('md:flex md:items-start md:gap-6', imagePosition === 'right' && 'md:flex-row-reverse')
                  : undefined

              const imgClass = cn(
                'h-auto w-full rounded-md bg-gray-50 object-cover',
                imageSize === 'wide' && 'lg:-mx-6',
                imageSize === 'full' && 'w-full',
              )

              return (
                <div
                  key={index}
                  className={cn(spanBySize[sizeKey], {
                    'md:col-span-2': size !== 'full',
                  })}
                >
                  <div className={wrapClass}>
                    {(() => {
                      const isHorizontal = imagePosition === 'left' || imagePosition === 'right'
                      const showImageFirst = imagePosition === 'top' || imagePosition === 'left'

                      const figureClass = cn(
                        isHorizontal && 'md:w-1/3',
                        imagePosition === 'right' && 'md:mt-0',
                        (imagePosition === 'bottom' || imagePosition === 'right') && 'mt-4',
                      )

                      const effectiveWidth = typeof width === 'number' ? width : 1200
                      const effectiveHeight = typeof height === 'number' ? height : 675

                      const imageEl = src ? (
                        <figure className={figureClass}>
                          <Image
                            src={src}
                            alt={alt}
                            width={effectiveWidth}
                            height={effectiveHeight}
                            className={imgClass}
                            unoptimized
                            sizes="100vw"
                          />
                          {caption && <figcaption className="mt-2 text-sm text-muted-foreground">{caption}</figcaption>}
                        </figure>
                      ) : null

                      const contentEl = (
                        <div className={cn(isHorizontal && src && 'md:w-2/3')}>
                          {richText && richText}
                          {link?.href && link.label ? (
                            <Link
                              className="mt-4 inline-flex"
                              href={link.href}
                              rel={link.newTab ? 'noopener noreferrer' : undefined}
                              target={link.newTab ? '_blank' : undefined}
                            >
                              {link.label}
                            </Link>
                          ) : null}
                        </div>
                      )

                      return showImageFirst ? (
                        <>
                          {imageEl}
                          {contentEl}
                        </>
                      ) : (
                        <>
                          {contentEl}
                          {imageEl}
                        </>
                      )
                    })()}
                  </div>
                </div>
              )
            })
          : null}
      </div>
    </Container>
  )
}
