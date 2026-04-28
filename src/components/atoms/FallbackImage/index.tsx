'use client'

import NextImage, { type ImageProps } from 'next/image'
import React from 'react'

import { IMAGE_PLACEHOLDER_BLUR } from '@/components/shared/media/imagePlaceholderBlur'
import { DEFAULT_IMAGE_QUALITY } from '@/imageConfig'

type FallbackImageProps = ImageProps & {
  fallbackSrc: ImageProps['src']
}

export const FallbackImage: React.FC<FallbackImageProps> = ({ fallbackSrc, src, onError, ...props }) => {
  const [imageFailed, setImageFailed] = React.useState(false)
  const { blurDataURL, fill, height, loading, placeholder, priority, quality, sizes, width, ...restProps } = props

  React.useEffect(() => {
    setImageFailed(false)
  }, [src])

  const resolvedSizes = sizes ?? (fill ? '100vw' : undefined)

  const resolvedLoading = loading || (!priority ? 'lazy' : undefined)

  return (
    <NextImage
      {...restProps}
      blurDataURL={blurDataURL ?? IMAGE_PLACEHOLDER_BLUR}
      fill={fill}
      height={fill ? undefined : height}
      loading={resolvedLoading}
      placeholder={placeholder ?? 'blur'}
      priority={priority}
      quality={quality ?? DEFAULT_IMAGE_QUALITY}
      sizes={resolvedSizes}
      width={fill ? undefined : width}
      src={imageFailed ? fallbackSrc : src}
      onError={(event) => {
        setImageFailed(true)
        onError?.(event)
      }}
    />
  )
}
