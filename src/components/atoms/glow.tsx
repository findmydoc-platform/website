import React from 'react'

import { cn } from '@/utilities/ui'

// NOTE: Scoped guideline exception
// ---------------------------------
// This atom uses inline styles to drive a highly designed glow effect from
// fully continuous numeric controls (size, offsets, intensity, falloff).
//
// The repo usually forbids `style={{ ... }}` and relies purely on Tailwind
// classes. Tailwind, however, can only generate utilities for static class
// strings it sees at build time – it cannot handle dynamic values like
// `translate-x-[${offset}%]`.
//
// To keep the public API numeric (no snapping to coarse steps) while still
// keeping the exception tightly scoped, we:
// - Use inline styles for inset, transform, blur, opacity and gradient stops.
// - Keep only structural pieces (positioning, shape hints) in Tailwind
//   classes so this remains easy to override.
//
// This file should remain the only place where this exception is used.

type GlowBrandToken = 'primary' | 'secondary' | 'accent' | 'accent-2' | 'success' | 'warning' | 'error'

export type GlowUnderlayValue = {
  enabled: boolean
  desktopOnly: boolean
  // Controls how far the glow extends beyond the frame (negative inset percentage).
  size: number
  // Horizontal translation in percent; negative = left, positive = right.
  offsetX: number
  // Vertical translation in percent; negative = up, positive = down.
  offsetY: number
  // Shape roundness (0-100). 0 = very tall ellipse, 100 = perfect circle.
  shape: number
  // Perceived strength of the glow (0-100).
  intensity: number
  // How quickly the glow fades out (0-100).
  falloff: number
  // Brand color token mapped from globals.
  color: GlowBrandToken
}

export type GlowUnderlayProps = Partial<GlowUnderlayValue> & {
  className?: string
}

type SizeStep = { value: number; className: string }
type OffsetStep = { value: number; className: string }

// External constraint: percentage insets are required to keep the glow scaling stable with the image wrapper.
// This finite set is enough for tuning while keeping Tailwind static analysis happy.
const SIZE_STEPS: SizeStep[] = [
  { value: 40, className: 'inset-[-40%]' },
  { value: 55, className: 'inset-[-55%]' },
  { value: 75, className: 'inset-[-75%]' },
  { value: 100, className: 'inset-[-100%]' },
  { value: 130, className: 'inset-[-130%]' },
  { value: 160, className: 'inset-[-160%]' },
]

// External constraint: percentage translations keep alignment stable during resizes.
const OFFSET_X_STEPS: OffsetStep[] = [
  { value: -30, className: 'translate-x-[-30%]' },
  { value: -20, className: 'translate-x-[-20%]' },
  { value: -10, className: 'translate-x-[-10%]' },
  { value: 0, className: 'translate-x-[0%]' },
  { value: 10, className: 'translate-x-[10%]' },
  { value: 20, className: 'translate-x-[20%]' },
  { value: 30, className: 'translate-x-[30%]' },
]

const OFFSET_Y_STEPS: OffsetStep[] = [
  { value: -30, className: 'translate-y-[-30%]' },
  { value: -20, className: 'translate-y-[-20%]' },
  { value: -12, className: 'translate-y-[-12%]' },
  { value: 0, className: 'translate-y-[0%]' },
  { value: 12, className: 'translate-y-[12%]' },
  { value: 20, className: 'translate-y-[20%]' },
  { value: 30, className: 'translate-y-[30%]' },
]

const COLOR_VAR_MAP: Record<GlowBrandToken, string> = {
  primary: 'var(--color-primary)',
  secondary: 'var(--color-secondary)',
  accent: 'var(--color-accent)',
  'accent-2': 'var(--color-accent-2)',
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  error: 'var(--color-error)',
}

const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value))
}

const snapOffset = (value: number, steps: OffsetStep[]): string => {
  const clamped = clamp(value, -40, 40)
  if (steps.length === 0) return ''

  const bestStep = steps.reduce<OffsetStep>((best, step) => {
    return Math.abs(step.value - clamped) < Math.abs(best.value - clamped) ? step : best
  }, steps[0] as OffsetStep)

  return bestStep.className
}

const snapSize = (value: number): string => {
  const clamped = clamp(value, 40, 160)
  if (SIZE_STEPS.length === 0) return ''

  const bestStep = SIZE_STEPS.reduce<SizeStep>((best, step) => {
    return Math.abs(step.value - clamped) < Math.abs(best.value - clamped) ? step : best
  }, SIZE_STEPS[0] as SizeStep)

  return bestStep.className
}
type ResolvedVisual = {
  opacity: number
  blurPx: number
  mixPercent: number
  stopPercent: number
}

const resolveVisual = (intensity: number, falloff: number): ResolvedVisual => {
  const iRaw = clamp(intensity, 0, 100) / 100
  const fRaw = clamp(falloff, 0, 100) / 100

  // Curved normalization so low values stay subtle and the
  // upper range has more visual punch.
  const i = Math.pow(iRaw, 1.15)
  const f = Math.pow(fRaw, 1.1)
  const longTail = 1 - f

  // Opacity: almost solid at high intensity + high falloff,
  // very soft at low intensity or very long tails.
  const baseOpacity = 0.08 + 0.9 * i // ~0.08 → 0.98
  const falloffOpacityFactor = 0.8 + 0.4 * f // short tail (f≈1) → brighter
  const opacity = clamp(baseOpacity * falloffOpacityFactor, 0.04, 0.99)

  // Blur radius: extremely blurred for soft/long-tail glows,
  // very tight for hard, intense, short-tail glows.
  const blurMin = 6
  const blurMax = 180
  const blurFactor = 0.2 * (1 - i) + 0.8 * longTail
  const blurPx = blurMin + (blurMax - blurMin) * blurFactor

  // Color mix: strong color at higher intensity, slightly
  // softened for very long tails so huge halos are not harsh.
  let mixPercent = 30 + 70 * i // ~30 → 100
  const mixDamp = 0.7 + 0.3 * f // long tail → softer, short tail → full
  mixPercent = clamp(mixPercent * mixDamp, 10, 98)

  // Gradient stops: control how far the glow extends. Long
  // tails push the stops outward, intensity slightly shrinks
  // the core so high-intensity glows can be compact.
  let stopPercent = 55 + 35 * longTail - 10 * i
  stopPercent = clamp(stopPercent, 35, 95)

  return {
    opacity,
    blurPx,
    mixPercent,
    stopPercent,
  }
}

export const GlowUnderlay: React.FC<GlowUnderlayProps> = ({
  className,
  enabled = true,
  desktopOnly = true,
  size = 55,
  offsetX = 0,
  offsetY = 20,
  shape = 100,
  intensity = 60,
  falloff = 60,
  color = 'primary',
}) => {
  if (!enabled) return null

  const { opacity, blurPx, mixPercent, stopPercent } = resolveVisual(intensity, falloff)

  const colorVar = COLOR_VAR_MAP[color]

  // Map size (0–≈220) to an inset magnitude with a concave curve so
  // the high end is less sensitive. This keeps very large halos from
  // reacting too aggressively to small numeric changes.
  const sizeClamped = clamp(size, 0, 220)
  const sizeNorm = sizeClamped / 220
  const insetBase = 40
  const insetMax = 200
  const insetMagnitude = insetBase + (insetMax - insetBase) * Math.pow(sizeNorm, 0.7)

  // Radius scale used to keep offset movement roughly constant even
  // when the halo grows far beyond the frame.
  const radiusScale = 1 + insetMagnitude / 100

  // Normalized roundness for shape scaling.
  const shapeT = clamp(shape, 0, 100) / 100
  // 0 → tall ellipse, 100 → circle.
  const scaleX = 0.7 + 0.3 * shapeT
  const scaleY = 1.6 - 0.6 * shapeT

  const rawTranslateX = clamp(offsetX, -60, 60)
  const rawTranslateY = clamp(offsetY, -60, 60)

  // Compensate translations for both scaling and halo radius so
  // percentage offsets remain visually stable when size or shape
  // change. Because we apply `translate(...) scale(...)`, the
  // translation is multiplied by the scale and effective radius.
  const translateX = rawTranslateX / ((scaleX || 1) * radiusScale)
  const translateY = rawTranslateY / ((scaleY || 1) * radiusScale)

  const sizeClass = snapSize(insetMagnitude)
  const offsetXClass = snapOffset(offsetX, OFFSET_X_STEPS)
  const offsetYClass = snapOffset(offsetY, OFFSET_Y_STEPS)

  const style: React.CSSProperties = {
    // Layout & position (continuous control)
    inset: `${-insetMagnitude}%`,
    transform: `translate(${translateX}%, ${translateY}%) scale(${scaleX}, ${scaleY})`,
    // Visual treatment
    opacity,
    filter: `blur(${blurPx}px)`,
    backgroundImage:
      `radial-gradient(circle closest-side at 75% 25%, ` +
      `color-mix(in srgb, ${colorVar} ${mixPercent}%, transparent), ` +
      `transparent ${stopPercent}%)`,
  }

  return (
    <div
      aria-hidden="true"
      className={cn(
        // Base
        'pointer-events-none absolute z-0',
        // Desktop only by default (matches Landing usage).
        desktopOnly ? 'hidden lg:block' : undefined,
        // Positioning (coarse structural hints; fine-grained values are inline).
        sizeClass,
        offsetXClass,
        offsetYClass,
        // Visual treatment: see `style` for continuous control.
        className,
      )}
      style={style}
    />
  )
}

export default GlowUnderlay
