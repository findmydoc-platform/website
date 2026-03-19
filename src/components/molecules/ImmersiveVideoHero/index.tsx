'use client'

import type { StaticImageData } from 'next/image'
import Image from 'next/image'
import { ChevronDown } from 'lucide-react'
import { type MouseEvent, type SyntheticEvent } from 'react'

import { Heading } from '@/components/atoms/Heading'
import { Button } from '@/components/atoms/button'
import { Logo } from '@/components/molecules/Logo/Logo'
import { usePrefersReducedMotion } from '@/utilities/use-prefers-reduced-motion'
import { cn } from '@/utilities/ui'

import { useImmersiveVideoLoop } from './logic'

export type ImmersiveVideoHeroProps = {
  className?: string
  contentClassName?: string
  ctaHref?: string
  ctaLabel?: string
  crossfadeMs?: number
  descriptionClassName?: string
  descriptionText?: string
  eyebrowClassName?: string
  eyebrowText?: string
  fallbackImageSrc?: StaticImageData | string
  headlineClassName?: string
  headlineText?: string
  mediaAlt?: string
  posterSrc?: StaticImageData | string
  requiredLabel?: string
  videoBlurPx?: number
  scrollHintHref?: string
  showScrollArrow?: boolean
  showLogo?: boolean
  subheadlineClassName?: string
  subheadlineText?: string
  useReducedMotionFallback?: boolean
  videoUrl?: string
  withCrossfade?: boolean
  playbackRate?: number
}

export function ImmersiveVideoHero({
  className,
  contentClassName,
  ctaHref,
  ctaLabel,
  crossfadeMs,
  descriptionClassName,
  descriptionText,
  eyebrowClassName,
  eyebrowText,
  fallbackImageSrc,
  headlineClassName,
  headlineText,
  mediaAlt = 'Immersive video hero',
  posterSrc,
  requiredLabel,
  videoBlurPx,
  scrollHintHref,
  showScrollArrow = false,
  showLogo = true,
  subheadlineClassName,
  subheadlineText,
  useReducedMotionFallback,
  videoUrl,
  withCrossfade = true,
  playbackRate,
}: ImmersiveVideoHeroProps) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const posterSource = typeof posterSrc === 'string' ? posterSrc : (posterSrc?.src ?? undefined)
  const imageFallback = posterSrc ?? fallbackImageSrc
  const videoRequiredLabel = requiredLabel ?? 'Video required: add videoUrl to enable motion'
  const normalizedBlurPx =
    typeof videoBlurPx === 'number' && Number.isFinite(videoBlurPx) ? Math.min(8, Math.max(0, videoBlurPx)) : 0
  const videoTransformClassName = normalizedBlurPx > 0 ? 'scale-[1.04] transform-gpu' : undefined
  const videoFilterStyle = {
    filter: `blur(${normalizedBlurPx}px) brightness(0.82) contrast(1.12) saturate(0.92)`,
  }

  const {
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
  } = useImmersiveVideoLoop({
    crossfadeMs,
    playbackRate,
    prefersReducedMotion,
    useReducedMotionFallback,
    videoUrl,
    withCrossfade,
  })

  const handleMetadataEvent = (event: SyntheticEvent<HTMLVideoElement>) => {
    handleVideoMetadata(event.currentTarget)
  }

  const placeholderLabel = videoSourceFailed ? 'Background video unavailable: check videoUrl' : videoRequiredLabel
  const shouldRenderButton = Boolean(ctaLabel && ctaHref)
  const shouldRenderScrollArrow = showScrollArrow && Boolean(scrollHintHref)

  const handleInPageNavigation = (event: MouseEvent<HTMLAnchorElement>, href?: string) => {
    if (!href?.startsWith('#')) return
    if (event.defaultPrevented) return
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

    const targetId = href.slice(1)
    if (!targetId) return

    const targetElement = document.getElementById(targetId)
    if (!targetElement) return

    event.preventDefault()

    const startY = window.scrollY
    const targetY = startY + targetElement.getBoundingClientRect().top
    const deltaY = targetY - startY

    if (Math.abs(deltaY) < 1) {
      window.history.replaceState(null, '', href)
      return
    }

    if (prefersReducedMotion) {
      window.scrollTo({ top: targetY, behavior: 'auto' })
      window.history.replaceState(null, '', href)
      return
    }

    const durationMs = 700
    const startTime = performance.now()
    const easeInOutCubic = (progress: number): number =>
      progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2

    const step = (currentTime: number) => {
      const elapsedMs = currentTime - startTime
      const progress = Math.min(elapsedMs / durationMs, 1)
      const easedProgress = easeInOutCubic(progress)

      window.scrollTo({
        top: startY + deltaY * easedProgress,
        behavior: 'auto',
      })

      if (progress < 1) {
        requestAnimationFrame(step)
        return
      }

      window.history.replaceState(null, '', href)
    }

    requestAnimationFrame(step)
  }

  return (
    <div
      data-testid="immersive-video-hero"
      className={cn(
        'relative min-h-[88vh] w-full overflow-hidden rounded-[38px] border border-white/80 bg-slate-950 shadow-[0_44px_130px_-62px_rgba(2,6,23,0.72)] sm:min-h-[92vh]',
        className,
      )}
    >
      {renderMode === 'dual-crossfade' ? (
        <>
          <video
            ref={videoARef}
            data-testid="hero-video-layer-a"
            data-video-source={videoSource}
            data-video-playback-rate={playbackRateValue.toFixed(2)}
            autoPlay
            muted
            playsInline
            preload="auto"
            onLoadedMetadata={handleMetadataEvent}
            onError={handleVideoError}
            poster={posterSource}
            className={cn(
              'absolute inset-0 h-full w-full object-cover transition-opacity ease-linear',
              videoTransformClassName,
              isLayerVisible('a') ? 'opacity-100' : 'opacity-0',
            )}
            style={{
              transitionDuration: `${crossfadeDurationMs}ms`,
              ...videoFilterStyle,
            }}
          >
            <source src={videoSource} />
          </video>

          <video
            ref={videoBRef}
            data-testid="hero-video-layer-b"
            data-video-source={videoSource}
            data-video-playback-rate={playbackRateValue.toFixed(2)}
            muted
            playsInline
            preload="auto"
            onLoadedMetadata={handleMetadataEvent}
            onError={handleVideoError}
            poster={posterSource}
            className={cn(
              'absolute inset-0 h-full w-full object-cover transition-opacity ease-linear',
              videoTransformClassName,
              isLayerVisible('b') ? 'opacity-100' : 'opacity-0',
            )}
            style={{
              transitionDuration: `${crossfadeDurationMs}ms`,
              ...videoFilterStyle,
            }}
          >
            <source src={videoSource} />
          </video>
        </>
      ) : null}

      {renderMode === 'native' ? (
        <video
          ref={nativeVideoRef}
          data-testid="hero-video-native"
          data-video-source={videoSource}
          data-video-playback-rate={playbackRateValue.toFixed(2)}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          onLoadedMetadata={handleMetadataEvent}
          onError={handleVideoError}
          poster={posterSource}
          className={cn('absolute inset-0 h-full w-full object-cover', videoTransformClassName)}
          style={videoFilterStyle}
        >
          <source src={videoSource} />
        </video>
      ) : null}

      {renderMode === 'reduced-motion' ? (
        <Image
          data-testid="hero-video-reduced-motion-fallback"
          src={imageFallback ?? fallbackImageSrc ?? '/fmd-logo-1-dark.svg'}
          alt={mediaAlt}
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
      ) : null}

      {renderMode === 'placeholder' ? (
        <>
          {imageFallback ? (
            <Image
              src={imageFallback}
              alt={mediaAlt}
              fill
              priority
              sizes="100vw"
              className="object-cover object-center"
            />
          ) : null}
          <div className="absolute inset-0 bg-linear-to-tr from-slate-900/20 via-slate-900/36 to-slate-950/48" />
          <div
            data-testid="hero-video-placeholder"
            className="absolute top-5 right-5 rounded-full border border-white/40 bg-white/18 px-4 py-2 text-xs font-semibold tracking-[0.18em] text-white uppercase backdrop-blur-md"
          >
            {placeholderLabel}
          </div>
        </>
      ) : null}

      <div className="absolute inset-0 bg-linear-to-t from-slate-950/92 via-slate-950/48 to-slate-900/70" />

      <div
        className={cn(
          'relative z-10 flex min-h-[88vh] flex-col items-center justify-center px-6 py-14 text-center sm:min-h-[92vh] sm:px-10',
          contentClassName,
        )}
      >
        {showLogo ? (
          <Logo
            variant="white"
            className="h-12 drop-shadow-[0_10px_24px_rgba(2,6,23,0.45)] sm:h-14"
            loading="eager"
            priority="high"
          />
        ) : null}

        {eyebrowText ? (
          <p className={cn('mt-6 text-xs font-semibold tracking-[0.24em] text-white/75 uppercase', eyebrowClassName)}>
            {eyebrowText}
          </p>
        ) : null}

        {subheadlineText ? (
          <p className={cn('mt-4 max-w-3xl text-sm leading-6 text-white/84 sm:text-base', subheadlineClassName)}>
            {subheadlineText}
          </p>
        ) : null}

        {headlineText ? (
          <Heading
            as="h1"
            align="center"
            variant="default"
            className={cn(
              'mt-4 max-w-5xl text-4xl leading-[1.02] font-semibold text-white [text-shadow:0_8px_28px_rgba(2,6,23,0.58)] sm:text-6xl lg:text-[6.2rem]',
              headlineClassName,
            )}
          >
            {headlineText}
          </Heading>
        ) : null}

        {descriptionText ? (
          <p
            className={cn(
              'mt-6 max-w-2xl text-base leading-7 text-white/90 [text-shadow:0_4px_18px_rgba(2,6,23,0.5)] sm:text-lg',
              descriptionClassName,
            )}
          >
            {descriptionText}
          </p>
        ) : null}

        {shouldRenderButton ? (
          <Button asChild type="button" variant="primary" hoverEffect="wave" className="mt-8 rounded-full px-8 py-6">
            <a href={ctaHref} onClick={(event) => handleInPageNavigation(event, ctaHref)}>
              {ctaLabel}
            </a>
          </Button>
        ) : null}
      </div>

      {shouldRenderScrollArrow ? (
        <a
          href={scrollHintHref}
          aria-label="Scroll down"
          onClick={(event) => handleInPageNavigation(event, scrollHintHref)}
          className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center justify-center text-white/85 transition hover:text-white focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <span className="animate-bounce">
            <ChevronDown className="h-5 w-5" aria-hidden="true" />
          </span>
        </a>
      ) : null}
    </div>
  )
}
