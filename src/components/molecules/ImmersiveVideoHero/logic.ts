import { useEffect, useMemo, useRef, useState } from 'react'

export type ImmersiveVideoRenderMode = 'placeholder' | 'reduced-motion' | 'dual-crossfade' | 'native'

export const normalizeCrossfadeMs = (value: number | undefined): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 700
  return Math.min(1400, Math.max(200, Math.round(value)))
}

export const normalizePlaybackRate = (value: number | undefined): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 1
  return Math.min(1.2, Math.max(0.5, value))
}

export const resolveVideoRenderMode = ({
  hasVideoSource,
  shouldDisableMotion,
  withCrossfade,
  fallbackToNativeLoop,
}: {
  fallbackToNativeLoop: boolean
  hasVideoSource: boolean
  shouldDisableMotion: boolean
  withCrossfade: boolean
}): ImmersiveVideoRenderMode => {
  if (!hasVideoSource) return 'placeholder'
  if (shouldDisableMotion) return 'reduced-motion'
  if (withCrossfade && !fallbackToNativeLoop) return 'dual-crossfade'
  return 'native'
}

export const useImmersiveVideoLoop = ({
  crossfadeMs,
  playbackRate,
  prefersReducedMotion,
  useReducedMotionFallback,
  videoUrl,
  withCrossfade,
}: {
  crossfadeMs?: number
  playbackRate?: number
  prefersReducedMotion: boolean
  useReducedMotionFallback?: boolean
  videoUrl?: string
  withCrossfade?: boolean
}) => {
  const videoSource = videoUrl?.trim() ?? ''
  const crossfadeDurationMs = useMemo(() => normalizeCrossfadeMs(crossfadeMs), [crossfadeMs])
  const playbackRateValue = useMemo(() => normalizePlaybackRate(playbackRate), [playbackRate])
  const shouldRespectReducedMotion = useReducedMotionFallback ?? true
  const shouldDisableMotion = videoSource.length > 0 && shouldRespectReducedMotion && prefersReducedMotion

  const [activeVideoLayer, setActiveVideoLayer] = useState<'a' | 'b'>('a')
  const [isCrossfading, setIsCrossfading] = useState(false)
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null)
  const [fallbackToNativeLoop, setFallbackToNativeLoop] = useState(false)
  const [videoSourceFailed, setVideoSourceFailed] = useState(false)

  const videoARef = useRef<HTMLVideoElement | null>(null)
  const videoBRef = useRef<HTMLVideoElement | null>(null)
  const nativeVideoRef = useRef<HTMLVideoElement | null>(null)
  const crossfadeLockRef = useRef(false)
  const crossfadeTimeoutRef = useRef<number | null>(null)

  const hasVideoSource = videoSource.length > 0 && !videoSourceFailed
  const renderMode = resolveVideoRenderMode({
    fallbackToNativeLoop,
    hasVideoSource,
    shouldDisableMotion,
    withCrossfade: withCrossfade ?? true,
  })

  useEffect(() => {
    setActiveVideoLayer('a')
    setIsCrossfading(false)
    setDurationSeconds(null)
    setFallbackToNativeLoop(false)
    setVideoSourceFailed(false)
    crossfadeLockRef.current = false

    if (crossfadeTimeoutRef.current !== null) {
      window.clearTimeout(crossfadeTimeoutRef.current)
      crossfadeTimeoutRef.current = null
    }
  }, [videoSource, withCrossfade, shouldDisableMotion])

  useEffect(() => {
    return () => {
      if (crossfadeTimeoutRef.current !== null) {
        window.clearTimeout(crossfadeTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (renderMode !== 'dual-crossfade' || durationSeconds !== null) return

    const metadataTimeout = window.setTimeout(() => {
      setFallbackToNativeLoop(true)
    }, 4500)

    return () => {
      window.clearTimeout(metadataTimeout)
    }
  }, [durationSeconds, renderMode])

  useEffect(() => {
    if (renderMode !== 'dual-crossfade') return

    const activeVideo = activeVideoLayer === 'a' ? videoARef.current : videoBRef.current
    const standbyVideo = activeVideoLayer === 'a' ? videoBRef.current : videoARef.current
    if (!activeVideo || !standbyVideo) return

    activeVideo.playbackRate = playbackRateValue
    activeVideo.defaultPlaybackRate = playbackRateValue
    standbyVideo.playbackRate = playbackRateValue
    standbyVideo.defaultPlaybackRate = playbackRateValue

    standbyVideo.pause()
    try {
      standbyVideo.currentTime = 0
    } catch {
      // Ignore currentTime resets before metadata is available.
    }

    void activeVideo.play().catch(() => {
      setVideoSourceFailed(true)
    })
  }, [activeVideoLayer, playbackRateValue, renderMode, videoSource])

  useEffect(() => {
    const videoNodes = [videoARef.current, videoBRef.current, nativeVideoRef.current]
    videoNodes.forEach((videoNode) => {
      if (!videoNode) return
      videoNode.playbackRate = playbackRateValue
      videoNode.defaultPlaybackRate = playbackRateValue
    })
  }, [playbackRateValue])

  useEffect(() => {
    if (renderMode !== 'dual-crossfade' || durationSeconds === null) return

    const monitorInterval = window.setInterval(() => {
      if (crossfadeLockRef.current) return

      const activeVideo = activeVideoLayer === 'a' ? videoARef.current : videoBRef.current
      const standbyVideo = activeVideoLayer === 'a' ? videoBRef.current : videoARef.current
      if (!activeVideo || !standbyVideo) return

      const activeDuration =
        Number.isFinite(activeVideo.duration) && activeVideo.duration > 0 ? activeVideo.duration : durationSeconds
      if (!activeDuration || activeDuration <= 0) return

      const crossfadeSeconds = Math.max(crossfadeDurationMs / 1000, 0.2)
      const triggerAt = Math.max(activeDuration - crossfadeSeconds, crossfadeSeconds)
      if (activeVideo.currentTime < triggerAt) return

      crossfadeLockRef.current = true
      const nextLayer: 'a' | 'b' = activeVideoLayer === 'a' ? 'b' : 'a'

      try {
        standbyVideo.currentTime = 0
      } catch {
        // Ignore currentTime resets before metadata is available.
      }

      standbyVideo.playbackRate = playbackRateValue
      standbyVideo.defaultPlaybackRate = playbackRateValue

      void standbyVideo.play().catch(() => {
        crossfadeLockRef.current = false
        setFallbackToNativeLoop(true)
      })

      setIsCrossfading(true)

      if (crossfadeTimeoutRef.current !== null) {
        window.clearTimeout(crossfadeTimeoutRef.current)
      }

      crossfadeTimeoutRef.current = window.setTimeout(() => {
        activeVideo.pause()
        try {
          activeVideo.currentTime = 0
        } catch {
          // Ignore currentTime resets before metadata is available.
        }

        setActiveVideoLayer(nextLayer)
        setIsCrossfading(false)
        crossfadeLockRef.current = false
        crossfadeTimeoutRef.current = null
      }, crossfadeDurationMs)
    }, 80)

    return () => {
      window.clearInterval(monitorInterval)
    }
  }, [activeVideoLayer, crossfadeDurationMs, durationSeconds, playbackRateValue, renderMode])

  const handleVideoMetadata = (videoNode: HTMLVideoElement) => {
    videoNode.playbackRate = playbackRateValue
    videoNode.defaultPlaybackRate = playbackRateValue

    const nextDuration = videoNode.duration
    if (Number.isFinite(nextDuration) && nextDuration > 0) {
      setDurationSeconds(nextDuration)
      setFallbackToNativeLoop(false)
    }
  }

  const handleVideoError = () => {
    setVideoSourceFailed(true)
  }

  const isLayerVisible = (layer: 'a' | 'b'): boolean => {
    if (!isCrossfading) return activeVideoLayer === layer
    return activeVideoLayer !== layer
  }

  return {
    crossfadeDurationMs,
    handleVideoError,
    handleVideoMetadata,
    isLayerVisible,
    playbackRateValue,
    renderMode,
    videoARef,
    videoBRef,
    videoSource,
    videoSourceFailed,
    nativeVideoRef,
  }
}
