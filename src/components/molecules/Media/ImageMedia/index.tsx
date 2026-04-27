import { cn } from '@/utilities/ui'
import NextImage from 'next/image'
import React from 'react'

import type { Props as MediaProps } from '../types'

import { DEFAULT_IMAGE_QUALITY } from '@/imageConfig'
import { IMAGE_PLACEHOLDER_BLUR } from '@/components/shared/media/imagePlaceholderBlur'

export const ImageMedia: React.FC<MediaProps> = (props) => {
  const {
    alt: altFromProps,
    fill,
    imgClassName,
    priority,
    size: sizeFromProps,
    src: srcFromProps,
    loading: loadingFromProps,
    width,
    height,
  } = props

  const src = srcFromProps || ''
  const alt = altFromProps || ''

  const loading = loadingFromProps || (!priority ? 'lazy' : undefined)
  const sizes = sizeFromProps || (fill ? '100vw' : undefined)

  return (
    <NextImage
      alt={alt}
      className={cn(imgClassName)}
      fill={fill}
      height={!fill ? height : undefined}
      placeholder="blur"
      blurDataURL={IMAGE_PLACEHOLDER_BLUR}
      priority={priority}
      quality={DEFAULT_IMAGE_QUALITY}
      loading={loading}
      sizes={sizes}
      src={src}
      width={!fill ? width : undefined}
    />
  )
}
