import type { StaticImageData } from 'next/image'

import { cn } from '@/utilities/ui'
import React from 'react'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'

import { Media } from '@/components/molecules/Media'
import RichText from '@/components/organisms/RichText'
import { containerVariants } from '@/components/molecules/Container'

export type MediaBlockMedia = {
  id?: number
  url?: string | null
  alt?: string | null
  caption?: SerializedEditorState | null
  width?: number | null
  height?: number | null
  mimeType?: string | null
}

export type MediaBlockProps = {
  breakout?: boolean
  captionClassName?: string
  className?: string
  enableGutter?: boolean
  imgClassName?: string
  media?: MediaBlockMedia | number | string | null
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

  // Type guard: check if media is a MediaBlockMedia object (has 'id' and 'url')
  const isMediaObject = (m: typeof media): m is MediaBlockMedia => {
    return typeof m === 'object' && m !== null && 'id' in m && 'url' in m
  }

  const caption = isMediaObject(media) ? media.caption : undefined

  return (
    <div className={cn(enableGutter ? containerVariants({ variant: 'default' }) : '', className)}>
      {(media || staticImage) && (
        <Media 
          imgClassName={cn('rounded-xl border border-border', imgClassName)} 
          resource={media as unknown as Parameters<typeof Media>[0]['resource']} 
          src={staticImage} 
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
          <RichText data={caption} enableGutter={false} enableProse={false} className="text-sm text-muted-foreground" />
        </div>
      )}
    </div>
  )
}
