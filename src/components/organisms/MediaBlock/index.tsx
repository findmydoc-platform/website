import type { StaticImageData } from 'next/image'

import { cn } from '@/utilities/ui'
import React from 'react'

import { Media } from '@/components/molecules/Media'
import { containerVariants } from '@/components/molecules/Container'

export type MediaBlockProps = {
  breakout?: boolean
  captionClassName?: string
  className?: string
  enableGutter?: boolean
  imgClassName?: string
  staticImage?: StaticImageData
  disableInnerContainer?: boolean
  src?: string | StaticImageData
  width?: number
  height?: number
  alt?: string
  type?: 'video' | 'image'
  caption?: React.ReactNode
}

export const MediaBlock: React.FC<MediaBlockProps> = (props) => {
  const {
    captionClassName,
    className,
    enableGutter = true,
    imgClassName,
    staticImage,
    disableInnerContainer,
    src,
    width,
    height,
    alt,
    type,
    caption,
  } = props

  const finalSrc = staticImage || src

  return (
    <div className={cn(enableGutter ? containerVariants({ variant: 'default' }) : '', className)}>
      {finalSrc && (
        <Media
          imgClassName={cn('rounded-xl border border-border', imgClassName)}
          src={finalSrc}
          width={width}
          height={height}
          alt={alt}
          type={type}
        />
      )}
      {caption && (
        <div
          className={cn(
            'mt-6',
            !disableInnerContainer && !enableGutter && containerVariants({ variant: 'default' }),
            captionClassName,
          )}
        >
          {caption}
        </div>
      )}
    </div>
  )
}
