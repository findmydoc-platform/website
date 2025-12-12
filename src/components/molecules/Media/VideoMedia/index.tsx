'use client'

import { cn } from '@/utilities/ui'
import React, { useEffect, useRef } from 'react'

import type { Props as MediaProps } from '../types'

export const VideoMedia: React.FC<MediaProps> = (props) => {
  const { onClick, src, videoClassName } = props

  const videoRef = useRef<HTMLVideoElement>(null)
  // const [showFallback] = useState<boolean>()

  useEffect(() => {
    const { current: video } = videoRef
    if (video) {
      video.addEventListener('suspend', () => {
        // setShowFallback(true);
        // console.warn('Video was suspended, rendering fallback image.')
      })
    }
  }, [])

  if (!src || typeof src !== 'string') return null

  return (
    <video
      autoPlay
      className={cn(videoClassName)}
      controls={false}
      loop
      muted
      onClick={onClick}
      playsInline
      ref={videoRef}
    >
      <source src={src} />
    </video>
  )
}
