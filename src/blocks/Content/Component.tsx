import React from 'react'
import Image from 'next/image'
import { cn } from '@/utilities/ui'
import RichText from '@/components/RichText'
import type { ContentBlock as ContentBlockProps, PlatformContentMedia } from '@/payload-types'
import { CMSLink } from '@/components/Link'

type ColSize = 'full' | 'half' | 'oneThird' | 'twoThirds'

const spanBySize: Record<ColSize, string> = {
  full: 'layout-span-full',
  half: 'layout-span-half',
  oneThird: 'layout-span-one-third',
  twoThirds: 'layout-span-two-thirds',
}

function pickImageSrc(m?: PlatformContentMedia | number | string | null, preferredSize?: string) {
  // In Payload, upload relationships can be a document, an ID (number/string), or null
  if (!m || typeof m === 'number' || typeof m === 'string') {
    return { src: undefined, width: undefined, height: undefined }
  }

  const sizesRecord = (m.sizes ?? {}) as Record<
    string,
    { url?: string | null; width?: number | null; height?: number | null }
  >
  const sizeKey = preferredSize && sizesRecord?.[preferredSize] ? preferredSize : undefined
  const chosen = sizeKey ? sizesRecord[sizeKey] : undefined
  const src = (chosen?.url ?? m.url) || undefined
  const width = chosen?.width ?? m.width
  const height = chosen?.height ?? m.height
  return { src, width, height }
}

export const ContentBlock: React.FC<ContentBlockProps> = (props) => {
  const { columns } = props

  return (
    <div className="my-12">
      <div className="grid grid-cols-4 gap-x-12 gap-y-8 lg:grid-cols-12 lg:gap-x-16">
        {columns?.length
          ? columns.map((col, index) => {
              const {
                enableLink,
                link,
                richText,
                size,
                image,
                imagePosition = 'top',
                imageSize = 'content',
                caption,
              } = col || {}

              const sizeKey: ColSize = (size ?? 'oneThird') as ColSize
              const preferredSize = imageSize === 'full' ? undefined : 'card'
              const { src, width, height } = pickImageSrc(image, preferredSize)
              const alt =
                typeof image === 'object' && image ? (image as PlatformContentMedia).alt || '' : ''

              const wrapClass =
                imagePosition === 'left' || imagePosition === 'right'
                  ? cn('md:flex md:items-start md:gap-6', imagePosition === 'right' && 'md:flex-row-reverse')
                  : undefined

              const imgClass = cn(
                'h-auto w-full rounded-md bg-gray-50 object-cover dark:bg-zinc-900',
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
                          {richText && <RichText data={richText} enableGutter={false} />}
                          {enableLink && link && <CMSLink {...link} className="mt-4 inline-flex" />}
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
    </div>
  )
}
