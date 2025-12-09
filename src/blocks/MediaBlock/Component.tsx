import type { StaticImageData } from 'next/image'

import React from 'react'

import type { MediaBlock as MediaBlockPayload } from '@/payload-types'

import { MediaBlock } from '@/components/organisms/MediaBlock'

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

  return (
    <MediaBlock
      captionClassName={captionClassName}
      className={className}
      enableGutter={enableGutter}
      imgClassName={imgClassName}
      media={media}
      staticImage={staticImage}
      disableInnerContainer={disableInnerContainer}
    />
  )
}

export { MediaBlockComponent as MediaBlock }
