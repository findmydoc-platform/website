'use client'

import type { StaticImageData } from 'next/image'
import Image from 'next/image'
import { type SyntheticEvent } from 'react'

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
              'absolute inset-0 h-full w-full object-cover brightness-[0.82] contrast-[1.12] saturate-[0.92] transition-opacity ease-linear',
              isLayerVisible('a') ? 'opacity-100' : 'opacity-0',
            )}
            style={{ transitionDuration: `${crossfadeDurationMs}ms` }}
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
              'absolute inset-0 h-full w-full object-cover brightness-[0.82] contrast-[1.12] saturate-[0.92] transition-opacity ease-linear',
              isLayerVisible('b') ? 'opacity-100' : 'opacity-0',
            )}
            style={{ transitionDuration: `${crossfadeDurationMs}ms` }}
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
          className="absolute inset-0 h-full w-full object-cover brightness-[0.82] contrast-[1.12] saturate-[0.92]"
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

      <div className="absolute inset-0 bg-linear-to-t from-slate-950/82 via-slate-950/24 to-slate-900/58" />

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
            <a href={ctaHref}>{ctaLabel}</a>
          </Button>
        ) : null}
      </div>
    </div>
  )
}
