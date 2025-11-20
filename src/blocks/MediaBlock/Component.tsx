import type { StaticImageData } from 'next/image'

import { cn } from '@/utilities/ui'
import React from 'react'

import type { MediaBlock as MediaBlockProps } from '@/payload-types'

import { Media } from '../../components/Media'
import RichText from '@/components/RichText'

type Props = MediaBlockProps & {
  breakout?: boolean
  captionClassName?: string
  className?: string
  enableGutter?: boolean
  imgClassName?: string
  staticImage?: StaticImageData
  disableInnerContainer?: boolean
}

export const MediaBlock: React.FC<Props> = (props) => {
  const {
    captionClassName,
    className,
    enableGutter = true,
    imgClassName,
    media,
    staticImage,
    disableInnerContainer,
  } = props

  const caption = media && typeof media === 'object' ? (media as any).caption : undefined

  return (
    <div
      className={cn(enableGutter ? 'page-shell' : '', className)}
    >
      {(media || staticImage) && (
        <Media
          imgClassName={cn('rounded-[0.8rem] border border-border', imgClassName)}
          resource={media}
          src={staticImage}
        />
      )}
      {caption && (
        <div className={cn('mt-6', !disableInnerContainer && 'page-shell', captionClassName)}>
          <RichText
            data={caption}
            enableGutter={false}
            enableProse={false}
            className="text-sm text-muted-foreground"
          />
        </div>
      )}
    </div>
  )
}
