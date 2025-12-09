import type { StaticImageData } from 'next/image'

import { cn } from '@/utilities/ui'
import React from 'react'

import type { MediaBlock as MediaBlockType, PlatformContentMedia } from '@/payload-types'

import { Media } from '@/components/molecules/Media'
import RichText from '@/components/organisms/RichText'
import { containerVariants } from '@/components/molecules/Container'

export type MediaBlockProps = {
  breakout?: boolean
  captionClassName?: string
  className?: string
  enableGutter?: boolean
  imgClassName?: string
  media?: MediaBlockType['media']
  staticImage?: StaticImageData
  disableInnerContainer?: boolean
}

export const MediaBlock: React.FC<MediaBlockProps> = (props) => {
  const {
    captionClassName,
    className,
    enableGutter = true,
    imgClassName,
    media,
    staticImage,
    disableInnerContainer,
  } = props

  const caption = media && typeof media === 'object' ? (media as PlatformContentMedia).caption : undefined

  return (
    <div className={cn(enableGutter ? containerVariants({ variant: 'default' }) : '', className)}>
      {(media || staticImage) && (
        <Media imgClassName={cn('rounded-xl border border-border', imgClassName)} resource={media} src={staticImage} />
      )}
      {caption && (
        <div
          className={cn(
            'mt-6',
            !disableInnerContainer && !enableGutter && containerVariants({ variant: 'default' }),
            captionClassName,
          )}
        >
          <RichText data={caption} enableGutter={false} enableProse={false} className="text-sm text-muted-foreground" />
        </div>
      )}
    </div>
  )
}
