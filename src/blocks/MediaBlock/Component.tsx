import type { StaticImageData } from 'next/image'
import React from 'react'
import type { MediaBlock as MediaBlockPayload, PlatformContentMedia } from '@/payload-types'
import { MediaBlock as MediaBlockOrganism } from '@/components/organisms/MediaBlock'
import RichText from '@/blocks/_shared/RichText'

type Props = MediaBlockPayload & {
  breakout?: boolean
  captionClassName?: string
  className?: string
  enableGutter?: boolean
  imgClassName?: string
  staticImage?: StaticImageData
  disableInnerContainer?: boolean
}

export const MediaBlockComponent: React.FC<Props> = (props) => {
  const { captionClassName, className, enableGutter, imgClassName, media, staticImage, disableInnerContainer } = props

  let src: string | undefined
  let width: number | undefined
  let height: number | undefined
  let alt: string | undefined
  let type: 'video' | 'image' | undefined
  let captionNode: React.ReactNode

  if (media && typeof media === 'object') {
    const m = media as PlatformContentMedia
    src = m.url || undefined
    width = m.width || undefined
    height = m.height || undefined
    alt = m.alt || undefined
    if (m.mimeType?.includes('video')) {
      type = 'video'
    }
    if (m.caption) {
      captionNode = (
        <RichText data={m.caption} enableGutter={false} enableProse={false} className="text-sm text-muted-foreground" />
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
      type={type}
      caption={captionNode}
    />
  )
}

export { MediaBlockComponent as MediaBlock }
