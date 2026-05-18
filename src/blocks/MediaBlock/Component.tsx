import type { StaticImageData } from 'next/image'
import React from 'react'
import type { MediaBlock as MediaBlockPayload, PlatformContentMedia } from '@/payload-types'
import { MediaBlock as MediaBlockOrganism } from '@/components/organisms/MediaBlock'
import RichText from '@/blocks/_shared/RichText'
import type { ContentLocaleContext } from '@/utilities/contentLocalization'
import { resolveMediaImage } from '@/utilities/media/resolveMediaImage'

type Props = MediaBlockPayload & {
  breakout?: boolean
  captionClassName?: string
  className?: string
  contentLocale?: ContentLocaleContext
  enableGutter?: boolean
  imgClassName?: string
  staticImage?: StaticImageData
  disableInnerContainer?: boolean
}

export const MediaBlockComponent: React.FC<Props> = (props) => {
  const {
    captionClassName,
    className,
    contentLocale,
    enableGutter,
    imgClassName,
    media,
    staticImage,
    disableInnerContainer,
  } = props

  let src: string | undefined
  let width: number | undefined
  let height: number | undefined
  let alt: string | undefined
  let size: string | undefined
  let quality: number | undefined
  let type: 'video' | 'image' | undefined
  let captionNode: React.ReactNode

  if (media && typeof media === 'object') {
    const m = media as PlatformContentMedia
    if (m.mimeType?.includes('video')) {
      src = m.url || undefined
      width = m.width || undefined
      height = m.height || undefined
      alt = m.alt || undefined
      type = 'video'
    } else {
      const image = resolveMediaImage(m, {
        fallbackAlt: m.alt || undefined,
        usage: 'content',
      })
      src = image?.src
      width = image?.width
      height = image?.height
      alt = image?.alt
      size = image?.sizes
      quality = image?.quality
    }
    if (m.caption) {
      captionNode = (
        <RichText
          className="text-sm text-muted-foreground"
          contentLocale={contentLocale}
          data={m.caption}
          enableGutter={false}
          enableProse={false}
        />
      )
    }
  }

  return (
    <MediaBlockOrganism
      captionClassName={captionClassName}
      className={className}
      enableGutter={enableGutter}
      imgClassName={imgClassName}
      staticImage={staticImage}
      disableInnerContainer={disableInnerContainer}
      src={src}
      width={width}
      height={height}
      alt={alt}
      size={size}
      quality={quality}
      type={type}
      caption={captionNode}
    />
  )
}

export { MediaBlockComponent as MediaBlock }
