'use client'

import NextImage, { type ImageProps } from 'next/image'
import React from 'react'

import { IMAGE_PLACEHOLDER_BLUR } from '@/components/shared/media/imagePlaceholderBlur'
import { DEFAULT_IMAGE_QUALITY } from '@/imageConfig'

type FallbackImageProps = ImageProps & {
  fallbackSrc: ImageProps['src'] | readonly ImageProps['src'][]
}

export const FallbackImage: React.FC<FallbackImageProps> = ({ fallbackSrc, src, onError, ...props }) => {
  const [sourceIndex, setSourceIndex] = React.useState(0)
  const { blurDataURL, fill, height, loading, placeholder, priority, quality, sizes, width, ...restProps } = props
  const fallbackSources = Array.isArray(fallbackSrc) ? fallbackSrc : [fallbackSrc]
  const sources = [src, ...fallbackSources]

  React.useEffect(() => {
    setSourceIndex(0)
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
      src={sources[sourceIndex] ?? sources[sources.length - 1]}
      onError={(event) => {
        setSourceIndex((currentIndex) => Math.min(currentIndex + 1, sources.length - 1))
        onError?.(event)
      }}
    />
  )
}
