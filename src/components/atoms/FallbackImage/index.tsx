'use client'

import NextImage, { type ImageProps } from 'next/image'
import React from 'react'

type FallbackImageProps = ImageProps & {
  fallbackSrc: ImageProps['src']
}

export const FallbackImage: React.FC<FallbackImageProps> = ({ fallbackSrc, src, onError, ...props }) => {
  const [imageFailed, setImageFailed] = React.useState(false)
  const { fill, height, width, ...restProps } = props

  React.useEffect(() => {
    setImageFailed(false)
  }, [src])

  return (
    <NextImage
      {...restProps}
      fill={fill}
      height={fill ? undefined : height}
      width={fill ? undefined : width}
      src={imageFailed ? fallbackSrc : src}
      onError={(event) => {
        setImageFailed(true)
        onError?.(event)
      }}
    />
  )
}
