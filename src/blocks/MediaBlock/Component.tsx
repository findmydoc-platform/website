import type { StaticImageData } from 'next/image'

import { cn } from '@/utilities/ui'
import React from 'react'

import type { MediaBlock as MediaBlockProps } from '@/payload-types'

import { Media } from '@/components/molecules/Media'
import RichText from '@/components/organisms/RichText'
import { containerVariants } from '@/components/molecules/Container'

type RichTextData = React.ComponentProps<typeof RichText>['data']

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

  const caption: RichTextData | null =
    media &&
    typeof media === 'object' &&
    'caption' in media &&
    typeof (media as { caption?: unknown }).caption === 'object'
      ? ((media as { caption?: unknown }).caption as RichTextData)
      : null

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
