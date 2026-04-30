'use client'

import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'

import { Heading } from '@/components/atoms/Heading'
import { usePrefersReducedMotion } from '@/utilities/use-prefers-reduced-motion'
import { cn } from '@/utilities/ui'

export type LandingProcessRingPreset = 'calm' | 'balanced' | 'wild'
export type LandingProcessRingPalette = 'brand' | 'ocean' | 'mint' | 'ice' | 'mono'

export type LandingProcessRingStep = {
  id: string
  title: string
  body: string
}

export type LandingProcessRingProps = {
  title?: string
  size?: number
  preset?: LandingProcessRingPreset
  palette?: LandingProcessRingPalette
  accentColor?: string
  primaryColor?: string
  vibrancy?: number
  colorBalance?: number
  organicness?: number
  density?: number
  speed?: number
  wobble?: number
  glow?: number
  backgroundColor?: string
  startAngle?: number
  endAngle?: number
  orbitMargin?: number
  logoSrc?: string | null
  logoAlt?: string
  logoScale?: number
  steps?: ReadonlyArray<LandingProcessRingStep>
  className?: string
}

type OrganicRingBaseColors = {
  accent: string
  primary: string
}

type OrganicRingResolvedColors = OrganicRingBaseColors & {
  primaryDeep: string
  accentBridge: string
  midBridge: string
  blueBridge: string
  washMint1: string
  washMint2: string
  washMint3: string
  washBlue1: string
  washBlue2: string
  washBlue3: string
  mintSoft1: string
  mintSoft2: string
  mintSoft3: string
  blueSoft1: string
  blueSoft2: string
  blueSoft3: string
  blueSoft4: string
  ice1: string
  ice2: string
  ice3: string
  chalk1: string
  chalk2: string
  ghost1: string
  ghost2: string
}

type Wave = {
  frequency: number
  amplitude: number
  phaseFactor: number
}

type LayerTemplate = {
  id: string
  baseRadius: number
  rotate: number
  phase: number
  width: number
  opacity: number
  stroke: string
  filter?: string
  waves: Wave[]
}

type Layer = {
  id: string
  d: string
  baseRadius: number
  width: number
  opacity: number
  stroke: string
  filter?: string
}

type RGB = {
  r: number
  g: number
  b: number
}

type HSL = {
  h: number
  s: number
  l: number
}

type OrbitStepLayout = {
  id: string
  index: number
  angle: number
  left: number
  top: number
  width: number
  title: string
  body: string
}

type MotionConfig = {
  spinDuration: number
  wobbleDuration: number
  wobbleRotate: number[]
  x: number[]
  y: number[]
  scaleX: number[]
  scaleY: number[]
  opacity: number[]
}

type OrganicRingGraphicProps = {
  size: number | string
  preset: LandingProcessRingPreset
  palette: LandingProcessRingPalette
  accentColor?: string
  primaryColor?: string
  vibrancy: number
  colorBalance: number
  organicness?: number
  density?: number
  speed?: number
  wobble?: number
  glow?: number
  logoSrc?: string | null
  logoAlt: string
  logoScale: number
  motionActive?: boolean
}

const TAU = Math.PI * 2
const MAX_PROCESS_STEPS = 6
const DEFAULT_SIZE = 620
const DEFAULT_BACKGROUND = '#ffffff'
const DEFAULT_START_ANGLE = 60
const DEFAULT_END_ANGLE = 300
const DEFAULT_PROCESS_ORBIT_MARGIN = 146
const BASE_LOGO_SCALE = 0.34
const SCENE_PADDING_X = 380
const SCENE_PADDING_Y = 180
const SCENE_MIN_WIDTH = 1280
const SCENE_MIN_HEIGHT = 980
const MAX_VISIBLE_WASH_LAYERS = 4
const MAX_VISIBLE_TRACE_LAYERS = 10
const MAX_GLOW_LAYERS = 4
const MAX_INDEPENDENT_LAYERS = 2

export const landingProcessRingDefaultSteps: ReadonlyArray<LandingProcessRingStep> = [
  {
    id: 'signup-1',
    title: 'Create account',
    body: 'Start with your email address and a secure password to open your findmydoc profile.',
  },
  {
    id: 'signup-2',
    title: 'Verify email',
    body: 'Confirm your address so notifications and next steps always reach the right inbox.',
  },
  {
    id: 'signup-3',
    title: 'Complete profile',
    body: 'Add the basic details needed to tailor the onboarding flow and keep the process fast.',
  },
  {
    id: 'signup-4',
    title: 'Share documents',
    body: 'Upload the first files you already have so matching and support can start immediately.',
  },
  {
    id: 'signup-5',
    title: 'Set preferences',
    body: 'Choose language, location, and treatment preferences to refine the next recommendations.',
  },
  {
    id: 'signup-6',
    title: 'Confirm access',
    body: 'Review everything once, submit, and continue into the guided patient journey.',
  },
]

const DEFAULT_BRAND_COLORS: OrganicRingBaseColors = {
  accent: '#42E2B7',
  primary: '#0076FF',
}

const PALETTE_COLORS: Record<LandingProcessRingPalette, OrganicRingBaseColors> = {
  brand: DEFAULT_BRAND_COLORS,
  ocean: { accent: '#37D7E8', primary: '#1E80FF' },
  mint: { accent: '#58EDBC', primary: '#23B7D8' },
  ice: { accent: '#A9F3E4', primary: '#80B8FF' },
  mono: { accent: '#D5DEE8', primary: '#94A3B8' },
}

const PRESETS: Record<
  LandingProcessRingPreset,
  Required<Pick<LandingProcessRingProps, 'organicness' | 'density' | 'speed' | 'wobble' | 'glow'>>
> = {
  calm: { organicness: 0.16, density: 0.24, speed: 0.12, wobble: 0.08, glow: 0.02 },
  balanced: { organicness: 0.52, density: 0.58, speed: 0.34, wobble: 0.3, glow: 0.08 },
  wild: { organicness: 0.94, density: 0.96, speed: 0.82, wobble: 0.78, glow: 0.34 },
}

const WASH_PRIORITY = [0, 1, 2, 3, 4]
const TRACE_PRIORITY = [0, 7, 5, 1, 8, 2, 6, 9, 3, 10, 4, 11, 12, 13]

const WASH_TEMPLATES: LayerTemplate[] = [
  {
    id: 'wash-1',
    baseRadius: 262,
    rotate: -0.1,
    phase: 0.34,
    width: 30,
    opacity: 0.16,
    stroke: 'washMint',
    filter: 'softRibbon',
    waves: [
      { frequency: 1, amplitude: 4.6, phaseFactor: 0.38 },
      { frequency: 2, amplitude: 10.6, phaseFactor: 1 },
      { frequency: 3, amplitude: 5.6, phaseFactor: -0.72 },
      { frequency: 6, amplitude: 1.5, phaseFactor: 0.22 },
    ],
  },
  {
    id: 'wash-2',
    baseRadius: 258,
    rotate: -0.03,
    phase: 0.76,
    width: 26,
    opacity: 0.14,
    stroke: 'washBlue',
    filter: 'softRibbon',
    waves: [
      { frequency: 1, amplitude: 3.9, phaseFactor: 0.4 },
      { frequency: 2, amplitude: 9.5, phaseFactor: 1 },
      { frequency: 4, amplitude: 3.7, phaseFactor: -0.64 },
      { frequency: 7, amplitude: 1.2, phaseFactor: 0.24 },
    ],
  },
  {
    id: 'wash-3',
    baseRadius: 254,
    rotate: 0.05,
    phase: 1.04,
    width: 21,
    opacity: 0.12,
    stroke: 'washMint',
    filter: 'softRibbon',
    waves: [
      { frequency: 1, amplitude: 4.2, phaseFactor: 0.54 },
      { frequency: 2, amplitude: 8.2, phaseFactor: 1 },
      { frequency: 3, amplitude: 4.1, phaseFactor: -0.7 },
      { frequency: 5, amplitude: 1.3, phaseFactor: 0.3 },
    ],
  },
  {
    id: 'wash-4',
    baseRadius: 250,
    rotate: 0.08,
    phase: 1.32,
    width: 16,
    opacity: 0.1,
    stroke: 'washBlue',
    filter: 'softRibbon',
    waves: [
      { frequency: 1, amplitude: 3.1, phaseFactor: 0.36 },
      { frequency: 2, amplitude: 7.4, phaseFactor: 1 },
      { frequency: 4, amplitude: 3.3, phaseFactor: -0.62 },
      { frequency: 6, amplitude: 1.1, phaseFactor: 0.22 },
    ],
  },
  {
    id: 'wash-5',
    baseRadius: 247,
    rotate: -0.06,
    phase: 1.66,
    width: 12,
    opacity: 0.08,
    stroke: 'washMint',
    filter: 'softRibbon',
    waves: [
      { frequency: 1, amplitude: 3.4, phaseFactor: 0.5 },
      { frequency: 3, amplitude: 5.8, phaseFactor: 1 },
      { frequency: 4, amplitude: 2.8, phaseFactor: -0.54 },
      { frequency: 8, amplitude: 0.9, phaseFactor: 0.22 },
    ],
  },
]

const TRACE_TEMPLATES: LayerTemplate[] = [
  {
    id: 'trace-1',
    baseRadius: 272,
    rotate: -0.14,
    phase: 0.16,
    width: 5.8,
    opacity: 0.92,
    stroke: 'mintStroke',
    filter: 'traceSoft',
    waves: [
      { frequency: 1, amplitude: 5.2, phaseFactor: 0.46 },
      { frequency: 2, amplitude: 11.8, phaseFactor: 1 },
      { frequency: 3, amplitude: 6.1, phaseFactor: -0.72 },
      { frequency: 6, amplitude: 1.6, phaseFactor: 0.2 },
    ],
  },
  {
    id: 'trace-2',
    baseRadius: 269,
    rotate: -0.08,
    phase: 0.36,
    width: 4.6,
    opacity: 0.78,
    stroke: 'mintStrokeSoft',
    filter: 'traceSoft',
    waves: [
      { frequency: 1, amplitude: 4.4, phaseFactor: 0.34 },
      { frequency: 2, amplitude: 10.4, phaseFactor: 1 },
      { frequency: 4, amplitude: 4.2, phaseFactor: -0.58 },
      { frequency: 7, amplitude: 1.2, phaseFactor: 0.22 },
    ],
  },
  {
    id: 'trace-3',
    baseRadius: 266,
    rotate: -0.01,
    phase: 0.58,
    width: 3.5,
    opacity: 0.54,
    stroke: 'chalkStroke',
    waves: [
      { frequency: 1, amplitude: 4.8, phaseFactor: 0.48 },
      { frequency: 2, amplitude: 8.7, phaseFactor: 1 },
      { frequency: 5, amplitude: 2.6, phaseFactor: -0.42 },
      { frequency: 8, amplitude: 1.2, phaseFactor: 0.16 },
    ],
  },
  {
    id: 'trace-4',
    baseRadius: 263,
    rotate: 0.06,
    phase: 0.82,
    width: 2.8,
    opacity: 0.58,
    stroke: 'mintStroke',
    waves: [
      { frequency: 1, amplitude: 3.7, phaseFactor: 0.42 },
      { frequency: 3, amplitude: 7.2, phaseFactor: 1 },
      { frequency: 4, amplitude: 3.4, phaseFactor: -0.62 },
      { frequency: 9, amplitude: 1.1, phaseFactor: 0.2 },
    ],
  },
  {
    id: 'trace-5',
    baseRadius: 261,
    rotate: 0.11,
    phase: 1.02,
    width: 2.2,
    opacity: 0.42,
    stroke: 'ghostStroke',
    waves: [
      { frequency: 1, amplitude: 4.5, phaseFactor: 0.52 },
      { frequency: 2, amplitude: 6.9, phaseFactor: 1 },
      { frequency: 5, amplitude: 2.2, phaseFactor: -0.34 },
      { frequency: 10, amplitude: 0.8, phaseFactor: 0.2 },
    ],
  },
  {
    id: 'trace-6',
    baseRadius: 257,
    rotate: -0.05,
    phase: 0.9,
    width: 4.8,
    opacity: 0.86,
    stroke: 'iceStroke',
    filter: 'traceSoft',
    waves: [
      { frequency: 1, amplitude: 3.6, phaseFactor: 0.42 },
      { frequency: 2, amplitude: 8.2, phaseFactor: 1 },
      { frequency: 3, amplitude: 4.4, phaseFactor: -0.76 },
      { frequency: 8, amplitude: 1.2, phaseFactor: 0.24 },
    ],
  },
  {
    id: 'trace-7',
    baseRadius: 254,
    rotate: 0.02,
    phase: 1.1,
    width: 3.8,
    opacity: 0.68,
    stroke: 'chalkStroke',
    waves: [
      { frequency: 1, amplitude: 4.2, phaseFactor: 0.54 },
      { frequency: 2, amplitude: 7.4, phaseFactor: 1 },
      { frequency: 4, amplitude: 3.4, phaseFactor: -0.58 },
      { frequency: 9, amplitude: 1, phaseFactor: 0.18 },
    ],
  },
  {
    id: 'trace-8',
    baseRadius: 251,
    rotate: 0.09,
    phase: 1.24,
    width: 5.6,
    opacity: 0.95,
    stroke: 'blueStroke',
    filter: 'traceSoft',
    waves: [
      { frequency: 1, amplitude: 4.8, phaseFactor: 0.4 },
      { frequency: 2, amplitude: 8.8, phaseFactor: 1 },
      { frequency: 3, amplitude: 4.8, phaseFactor: -0.7 },
      { frequency: 6, amplitude: 1.4, phaseFactor: 0.24 },
    ],
  },
  {
    id: 'trace-9',
    baseRadius: 248,
    rotate: 0.04,
    phase: 1.42,
    width: 4.3,
    opacity: 0.82,
    stroke: 'blueStrokeSoft',
    filter: 'traceSoft',
    waves: [
      { frequency: 1, amplitude: 3.8, phaseFactor: 0.36 },
      { frequency: 2, amplitude: 7.9, phaseFactor: 1 },
      { frequency: 4, amplitude: 3.6, phaseFactor: -0.6 },
      { frequency: 7, amplitude: 1.2, phaseFactor: 0.2 },
    ],
  },
  {
    id: 'trace-10',
    baseRadius: 245,
    rotate: -0.03,
    phase: 1.56,
    width: 3.1,
    opacity: 0.56,
    stroke: 'chalkStroke',
    waves: [
      { frequency: 1, amplitude: 4.1, phaseFactor: 0.5 },
      { frequency: 3, amplitude: 6.6, phaseFactor: 1 },
      { frequency: 5, amplitude: 2.4, phaseFactor: -0.48 },
      { frequency: 9, amplitude: 0.9, phaseFactor: 0.18 },
    ],
  },
  {
    id: 'trace-11',
    baseRadius: 242,
    rotate: -0.1,
    phase: 1.74,
    width: 2.6,
    opacity: 0.46,
    stroke: 'iceStroke',
    waves: [
      { frequency: 1, amplitude: 3.5, phaseFactor: 0.42 },
      { frequency: 2, amplitude: 6.4, phaseFactor: 1 },
      { frequency: 4, amplitude: 2.8, phaseFactor: -0.52 },
      { frequency: 10, amplitude: 0.8, phaseFactor: 0.16 },
    ],
  },
  {
    id: 'trace-12',
    baseRadius: 239,
    rotate: 0.12,
    phase: 1.92,
    width: 2.1,
    opacity: 0.38,
    stroke: 'ghostStroke',
    waves: [
      { frequency: 1, amplitude: 4.3, phaseFactor: 0.52 },
      { frequency: 3, amplitude: 5.8, phaseFactor: 1 },
      { frequency: 6, amplitude: 1.9, phaseFactor: -0.3 },
      { frequency: 11, amplitude: 0.7, phaseFactor: 0.14 },
    ],
  },
  {
    id: 'trace-13',
    baseRadius: 236,
    rotate: 0.01,
    phase: 2.06,
    width: 1.7,
    opacity: 0.44,
    stroke: 'chalkStroke',
    waves: [
      { frequency: 1, amplitude: 3.1, phaseFactor: 0.42 },
      { frequency: 2, amplitude: 5.5, phaseFactor: 1 },
      { frequency: 5, amplitude: 2.1, phaseFactor: -0.36 },
      { frequency: 12, amplitude: 0.65, phaseFactor: 0.12 },
    ],
  },
  {
    id: 'trace-14',
    baseRadius: 233,
    rotate: -0.07,
    phase: 2.22,
    width: 1.3,
    opacity: 0.28,
    stroke: 'ghostStroke',
    waves: [
      { frequency: 1, amplitude: 4.1, phaseFactor: 0.46 },
      { frequency: 2, amplitude: 4.9, phaseFactor: 1 },
      { frequency: 7, amplitude: 1.6, phaseFactor: -0.24 },
      { frequency: 13, amplitude: 0.55, phaseFactor: 0.1 },
    ],
  },
]

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value))
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function lerp(min: number, max: number, amount: number) {
  return min + (max - min) * amount
}

function isHexColor(value: string) {
  return /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(value.trim())
}

function normalizeHex(value: string, fallback: string) {
  const trimmed = value.trim()

  if (!isHexColor(trimmed)) return fallback

  if (trimmed.length === 4) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`.toLowerCase()
  }

  return trimmed.toLowerCase()
}

function hexToRgb(hex: string): RGB {
  const normalized = normalizeHex(hex, '#000000').replace('#', '')

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  }
}

function rgbToHex({ r, g, b }: RGB) {
  const channelToHex = (channel: number) =>
    Math.max(0, Math.min(255, Math.round(channel)))
      .toString(16)
      .padStart(2, '0')

  return `#${channelToHex(r)}${channelToHex(g)}${channelToHex(b)}`
}

function rgbToHsl({ r, g, b }: RGB): HSL {
  const red = r / 255
  const green = g / 255
  const blue = b / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const lightness = (max + min) / 2

  if (max === min) return { h: 0, s: 0, l: lightness }

  const delta = max - min
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min)
  let hue = 0

  switch (max) {
    case red:
      hue = (green - blue) / delta + (green < blue ? 6 : 0)
      break
    case green:
      hue = (blue - red) / delta + 2
      break
    default:
      hue = (red - green) / delta + 4
      break
  }

  return {
    h: hue / 6,
    s: saturation,
    l: lightness,
  }
}

function hslToRgb({ h, s, l }: HSL): RGB {
  if (s === 0) {
    const value = l * 255

    return { r: value, g: value, b: value }
  }

  const hueToRgb = (p: number, q: number, t: number) => {
    let current = t

    if (current < 0) current += 1
    if (current > 1) current -= 1
    if (current < 1 / 6) return p + (q - p) * 6 * current
    if (current < 1 / 2) return q
    if (current < 2 / 3) return p + (q - p) * (2 / 3 - current) * 6
    return p
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q

  return {
    r: hueToRgb(p, q, h + 1 / 3) * 255,
    g: hueToRgb(p, q, h) * 255,
    b: hueToRgb(p, q, h - 1 / 3) * 255,
  }
}

function mixColors(colorA: string, colorB: string, amount: number) {
  const a = hexToRgb(colorA)
  const b = hexToRgb(colorB)
  const t = clamp01(amount)

  return rgbToHex({
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  })
}

function adjustSaturation(color: string, amount: number) {
  const hsl = rgbToHsl(hexToRgb(color))

  return rgbToHex(hslToRgb({ ...hsl, s: clamp01(hsl.s * amount) }))
}

function adjustLightness(color: string, amount: number) {
  const hsl = rgbToHsl(hexToRgb(color))

  return rgbToHex(hslToRgb({ ...hsl, l: clamp01(hsl.l * amount) }))
}

function normalizeAngle(angle: number) {
  const normalized = angle % 360

  return normalized < 0 ? normalized + 360 : normalized
}

function distributeAngles(startAngle: number, endAngle: number, count: number) {
  if (count === 0) return []

  const start = normalizeAngle(startAngle)
  const end = normalizeAngle(endAngle)
  let sweep = end - start

  if (sweep < 0) sweep += 360
  if (count === 1) return [start]
  if (sweep === 0) return Array.from({ length: count }, (_, index) => start + (360 / count) * index)

  const step = sweep / (count - 1)

  return Array.from({ length: count }, (_, index) => start + step * index)
}

function toClosedSpline(points: Array<{ x: number; y: number }>, tension = 0.94) {
  if (!points.length) return ''

  const firstPoint = points[0]

  if (!firstPoint) return ''

  let path = `M ${firstPoint.x.toFixed(2)} ${firstPoint.y.toFixed(2)}`

  for (let index = 0; index < points.length; index += 1) {
    const p0 = points[(index - 1 + points.length) % points.length]!
    const p1 = points[index % points.length]!
    const p2 = points[(index + 1) % points.length]!
    const p3 = points[(index + 2) % points.length]!
    const cp1x = p1.x + ((p2.x - p0.x) / 6) * tension
    const cp1y = p1.y + ((p2.y - p0.y) / 6) * tension
    const cp2x = p2.x - ((p3.x - p1.x) / 6) * tension
    const cp2y = p2.y - ((p3.y - p1.y) / 6) * tension

    path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
  }

  return `${path} Z`
}

function createOrganicRingPath({
  cx,
  cy,
  baseRadius,
  rotate = 0,
  phase = 0,
  waves = [],
  pointCount = 220,
}: {
  cx: number
  cy: number
  baseRadius: number
  rotate?: number
  phase?: number
  waves?: Wave[]
  pointCount?: number
}) {
  const points = Array.from({ length: pointCount }, (_, index) => {
    const angle = (index / pointCount) * TAU + rotate
    const radius = waves.reduce(
      (currentRadius, wave) =>
        currentRadius + Math.sin(angle * wave.frequency + phase * wave.phaseFactor) * wave.amplitude,
      baseRadius,
    )

    return {
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
    }
  })

  return toClosedSpline(points, 0.94)
}

function scaleWaves(waves: Wave[], organicness: number, density: number, index: number) {
  const amplitudeScale = lerp(0.42, 1.95, organicness)
  const densityOffset = lerp(-0.2, 0.24, density)
  const layerVariance = (index % 3 === 0 ? 0.07 : index % 3 === 1 ? -0.045 : 0.035) * lerp(0.55, 1.35, organicness)

  return waves.map((wave, waveIndex) => {
    const harmonicVariance = waveIndex === 0 ? 0.92 : waveIndex === 1 ? 1.08 : 1.18

    return {
      ...wave,
      amplitude: wave.amplitude * amplitudeScale * harmonicVariance * (1 + densityOffset + layerVariance),
    }
  })
}

function buildLayer(
  template: LayerTemplate,
  index: number,
  organicness: number,
  density: number,
  refUrl: (name: string) => string,
): Layer {
  const scaledWaves = scaleWaves(template.waves, organicness, density, index)
  const widthScale = lerp(0.76, 1.34, density)
  const opacityScale = lerp(0.7, 1.22, density)

  return {
    id: template.id,
    d: createOrganicRingPath({
      cx: 360,
      cy: 360,
      baseRadius: template.baseRadius,
      rotate: template.rotate,
      phase: template.phase,
      pointCount: 220,
      waves: scaledWaves,
    }),
    baseRadius: template.baseRadius,
    width: template.width * widthScale,
    opacity: template.opacity * opacityScale,
    stroke: refUrl(template.stroke),
    filter: template.filter ? refUrl(template.filter) : undefined,
  }
}

function buildVisibleLayers(
  templates: LayerTemplate[],
  priority: number[],
  visibleCount: number,
  organicness: number,
  density: number,
  refUrl: (name: string) => string,
) {
  const activeIndices = new Set(priority.slice(0, visibleCount))

  return templates
    .map((template, index) => ({ template, index }))
    .filter(({ index }) => activeIndices.has(index))
    .map(({ template, index }) => buildLayer(template, index, organicness, density, refUrl))
}

function createMotionConfig({
  speed,
  wobble,
  spinMultiplier,
  wobbleMultiplier,
  durationMultiplier = 1,
}: {
  speed: number
  wobble: number
  spinMultiplier: number
  wobbleMultiplier: number
  durationMultiplier?: number
}): MotionConfig {
  const baseSpinDuration = lerp(150, 8, speed)
  const baseWobbleDuration = lerp(24, 4.5, speed) * durationMultiplier
  const drift = lerp(0, 5.2, wobble) * wobbleMultiplier
  const squash = lerp(0, 0.035, wobble) * wobbleMultiplier
  const flicker = lerp(0, 0.18, wobble) * 0.55

  return {
    spinDuration: baseSpinDuration * spinMultiplier,
    wobbleDuration: baseWobbleDuration,
    wobbleRotate: [0, drift * 0.65, drift * 0.18, drift * 0.85, 0],
    x: [0, drift * 0.92, -drift * 0.72, drift * 0.58, 0],
    y: [0, -drift * 0.54, drift * 0.78, -drift * 0.34, 0],
    scaleX: [1, 1 + squash * 0.72, 1 - squash * 0.55, 1 + squash * 0.4, 1],
    scaleY: [1, 1 - squash * 0.42, 1 + squash * 0.8, 1 - squash * 0.3, 1],
    opacity: [1, 1 - flicker, 1, 1 - flicker * 0.65, 1],
  }
}

function resolveRingColors({
  palette,
  accentColor,
  primaryColor,
  vibrancy,
  colorBalance,
}: {
  palette: LandingProcessRingPalette
  accentColor?: string
  primaryColor?: string
  vibrancy: number
  colorBalance: number
}): OrganicRingResolvedColors {
  const baseColors =
    palette === 'brand'
      ? {
          accent: normalizeHex(accentColor ?? DEFAULT_BRAND_COLORS.accent, DEFAULT_BRAND_COLORS.accent),
          primary: normalizeHex(primaryColor ?? DEFAULT_BRAND_COLORS.primary, DEFAULT_BRAND_COLORS.primary),
        }
      : PALETTE_COLORS[palette]

  const accent = adjustSaturation(baseColors.accent, lerp(0.55, 1.45, vibrancy))
  const primary = adjustSaturation(baseColors.primary, lerp(0.6, 1.5, vibrancy))
  const primaryDeep = adjustLightness(primary, lerp(0.78, 0.92, vibrancy))
  const accentBridge = mixColors(accent, primary, lerp(0.2, 0.48, colorBalance))
  const midBridge = mixColors(accent, primary, lerp(0.44, 0.82, colorBalance))
  const blueBridge = mixColors(primary, accent, lerp(0.56, 0.18, colorBalance))

  return {
    accent,
    primary,
    primaryDeep,
    accentBridge,
    midBridge,
    blueBridge,
    washMint1: mixColors(accent, '#ffffff', 0.12),
    washMint2: accentBridge,
    washMint3: midBridge,
    washBlue1: primaryDeep,
    washBlue2: primary,
    washBlue3: mixColors(primary, accent, 0.28),
    mintSoft1: mixColors(accent, '#ffffff', 0.26),
    mintSoft2: mixColors(accentBridge, '#ffffff', 0.22),
    mintSoft3: mixColors(primary, '#ffffff', 0.34),
    blueSoft1: mixColors(primaryDeep, '#ffffff', 0.16),
    blueSoft2: mixColors(primary, '#ffffff', 0.18),
    blueSoft3: mixColors(blueBridge, '#ffffff', 0.4),
    blueSoft4: mixColors(accent, '#ffffff', 0.34),
    ice1: mixColors(accent, '#ffffff', 0.74),
    ice2: '#f9fffe',
    ice3: mixColors(primary, '#ffffff', 0.72),
    chalk1: mixColors(accentBridge, '#ffffff', 0.92),
    chalk2: mixColors(primary, '#ffffff', 0.92),
    ghost1: mixColors(accent, '#ffffff', 0.62),
    ghost2: mixColors(primary, '#ffffff', 0.68),
  }
}

function buildProcessOrbitLayout({
  steps,
  startAngle,
  endAngle,
  ringSize,
  orbitMargin,
  sceneWidth,
  sceneHeight,
}: {
  steps: ReadonlyArray<LandingProcessRingStep>
  startAngle: number
  endAngle: number
  ringSize: number
  orbitMargin: number
  sceneWidth: number
  sceneHeight: number
}) {
  if (steps.length === 0) return [] as OrbitStepLayout[]

  const cardWidth = 250
  const estimatedCardHeight = 128
  const centerX = sceneWidth / 2
  const centerY = sceneHeight / 2
  const ringRadius = ringSize / 2
  const orbitRadius = ringRadius + orbitMargin + Math.max(0, (steps.length - 4) * 10)
  const angles = distributeAngles(startAngle, endAngle, steps.length)

  return steps.map((step, index) => {
    const angle = angles[index] ?? 0
    const rad = ((normalizeAngle(angle) - 90) * Math.PI) / 180
    const anchorX = centerX + Math.cos(rad) * orbitRadius
    const anchorY = centerY + Math.sin(rad) * orbitRadius
    const horizontal = Math.cos(rad)
    const vertical = Math.sin(rad)
    let left = anchorX - cardWidth / 2
    let top = anchorY - estimatedCardHeight / 2

    if (horizontal > 0.34) {
      left = anchorX + 18
      top = anchorY - estimatedCardHeight / 2
    } else if (horizontal < -0.34) {
      left = anchorX - cardWidth - 18
      top = anchorY - estimatedCardHeight / 2
    } else if (vertical > 0) {
      left = anchorX - cardWidth / 2
      top = anchorY + 18
    } else {
      left = anchorX - cardWidth / 2
      top = anchorY - estimatedCardHeight - 18
    }

    return {
      id: step.id,
      index,
      angle,
      left: clamp(left, 28, sceneWidth - cardWidth - 28),
      top: clamp(top, 28, sceneHeight - estimatedCardHeight - 28),
      width: cardWidth,
      title: step.title,
      body: step.body,
    }
  })
}

function useSectionMotionActive() {
  const ref = useRef<HTMLElement | null>(null)
  const [isActive, setIsActive] = useState(false)

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      setIsActive(true)
      return
    }

    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsActive(Boolean(entry?.isIntersecting))
      },
      {
        rootMargin: '180px 0px',
        threshold: 0.01,
      },
    )

    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  return { ref, isActive }
}

function LayerPath({ layer }: { layer: Layer }) {
  return (
    <path
      d={layer.d}
      fill="none"
      stroke={layer.stroke}
      strokeWidth={layer.width}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={layer.opacity}
      filter={layer.filter}
    />
  )
}

function AnimatedLayerGroup({
  layers,
  config,
  reducedMotion,
}: {
  layers: Layer[]
  config: MotionConfig
  reducedMotion: boolean
}) {
  const outerRef = useRef<SVGGElement | null>(null)
  const innerRef = useRef<SVGGElement | null>(null)

  useLayoutEffect(() => {
    if (reducedMotion || !outerRef.current || !innerRef.current) return

    const outerGroup = outerRef.current
    const innerGroup = innerRef.current
    const keyframes = config.opacity.map((opacity, index) => ({
      rotation: config.wobbleRotate[index] ?? 0,
      x: config.x[index] ?? 0,
      y: config.y[index] ?? 0,
      scaleX: config.scaleX[index] ?? 1,
      scaleY: config.scaleY[index] ?? 1,
      opacity,
    }))

    const context = gsap.context(() => {
      gsap.set([outerGroup, innerGroup], {
        transformOrigin: 'center center',
        svgOrigin: '360 360',
      })

      const spinTween = gsap.to(outerGroup, {
        rotation: 360,
        duration: config.spinDuration,
        ease: 'none',
        repeat: -1,
      })

      const wobbleTween = gsap.to(innerGroup, {
        duration: config.wobbleDuration,
        ease: 'none',
        repeat: -1,
        keyframes,
      })

      return () => {
        spinTween.kill()
        wobbleTween.kill()
      }
    }, outerRef)

    return () => context.revert()
  }, [config, reducedMotion])

  return (
    <g ref={outerRef}>
      <g ref={innerRef}>
        {layers.map((layer) => (
          <LayerPath key={layer.id} layer={layer} />
        ))}
      </g>
    </g>
  )
}

function OrganicRingGraphic({
  size,
  preset,
  organicness,
  density,
  speed,
  wobble,
  glow,
  palette,
  accentColor,
  primaryColor,
  vibrancy,
  colorBalance,
  logoSrc,
  logoAlt,
  logoScale,
  motionActive = true,
}: OrganicRingGraphicProps) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const idPrefix = useId().replace(/:/g, '')
  const refId = (name: string) => `${idPrefix}-${name}`

  const resolved = useMemo(() => {
    const presetDefaults = PRESETS[preset]

    return {
      organicness: clamp01(organicness ?? presetDefaults.organicness),
      density: clamp01(density ?? presetDefaults.density),
      speed: clamp01(speed ?? presetDefaults.speed),
      wobble: clamp01(wobble ?? presetDefaults.wobble),
      glow: clamp01(glow ?? presetDefaults.glow),
      vibrancy: clamp01(vibrancy),
      colorBalance: clamp01(colorBalance),
    }
  }, [colorBalance, density, glow, organicness, preset, speed, vibrancy, wobble])

  const ringColors = useMemo(
    () =>
      resolveRingColors({
        palette,
        accentColor,
        primaryColor,
        vibrancy: resolved.vibrancy,
        colorBalance: resolved.colorBalance,
      }),
    [accentColor, palette, primaryColor, resolved.colorBalance, resolved.vibrancy],
  )

  const { washLayers, glowLayers, groupedLayers, independentLayers } = useMemo(() => {
    const refUrl = (name: string) => `url(#${idPrefix}-${name})`
    const washCount = Math.round(lerp(1, Math.min(WASH_TEMPLATES.length, MAX_VISIBLE_WASH_LAYERS), resolved.density))
    const traceCount = Math.round(lerp(3, Math.min(TRACE_TEMPLATES.length, MAX_VISIBLE_TRACE_LAYERS), resolved.density))

    const visibleWashLayers = buildVisibleLayers(
      WASH_TEMPLATES,
      WASH_PRIORITY,
      washCount,
      resolved.organicness,
      resolved.density,
      refUrl,
    )
    const visibleTraceLayers = buildVisibleLayers(
      TRACE_TEMPLATES,
      TRACE_PRIORITY,
      traceCount,
      resolved.organicness,
      resolved.density,
      refUrl,
    )

    const outerLayers = visibleTraceLayers.filter((layer) => layer.baseRadius >= 261)
    const middleLayers = visibleTraceLayers.filter((layer) => layer.baseRadius < 261 && layer.baseRadius >= 247)
    const fineLayers = visibleTraceLayers.filter((layer) => layer.baseRadius < 247)

    const independentCount = Math.min(
      fineLayers.length,
      Math.round(lerp(0, MAX_INDEPENDENT_LAYERS, (resolved.density + resolved.wobble) / 2)),
    )
    const independentIds = new Set(fineLayers.slice(-independentCount).map((layer) => layer.id))
    const groupedCoreLayers = [...middleLayers, ...fineLayers.filter((layer) => !independentIds.has(layer.id))]
    const separatedLayers = fineLayers.filter((layer) => independentIds.has(layer.id))

    const glowCount = Math.round(lerp(0, MAX_GLOW_LAYERS, resolved.glow))
    const glowIds = new Set(
      TRACE_PRIORITY.slice(0, glowCount)
        .map((index) => TRACE_TEMPLATES[index]?.id)
        .filter(Boolean),
    )

    const visibleGlowLayers = visibleTraceLayers
      .filter((layer) => glowIds.has(layer.id))
      .map((layer, index) => ({
        ...layer,
        id: `${layer.id}-glow`,
        width: layer.width + lerp(0, 7, resolved.glow) * (index < 2 ? 1 : index < 4 ? 0.78 : 0.56),
        opacity: layer.opacity * lerp(0, 0.28, resolved.glow) * (index < 2 ? 1 : index < 4 ? 0.8 : 0.64),
        filter: refUrl('controlledGlow'),
      }))

    return {
      washLayers: visibleWashLayers,
      glowLayers: visibleGlowLayers,
      groupedLayers: { outer: outerLayers, core: groupedCoreLayers },
      independentLayers: separatedLayers,
    }
  }, [idPrefix, resolved.density, resolved.glow, resolved.organicness, resolved.wobble])

  const motionDisabled = !motionActive || prefersReducedMotion || resolved.speed <= 0.01
  const washMotion = useMemo(
    () =>
      createMotionConfig({
        speed: resolved.speed,
        wobble: resolved.wobble,
        spinMultiplier: 1.38,
        wobbleMultiplier: 0.64,
        durationMultiplier: 1.12,
      }),
    [resolved.speed, resolved.wobble],
  )
  const outerMotion = useMemo(
    () =>
      createMotionConfig({
        speed: resolved.speed,
        wobble: resolved.wobble,
        spinMultiplier: 1,
        wobbleMultiplier: 0.88,
      }),
    [resolved.speed, resolved.wobble],
  )
  const coreMotion = useMemo(
    () =>
      createMotionConfig({
        speed: resolved.speed,
        wobble: resolved.wobble,
        spinMultiplier: 0.78,
        wobbleMultiplier: 1.06,
        durationMultiplier: 0.88,
      }),
    [resolved.speed, resolved.wobble],
  )
  const independentMotionConfigs = useMemo(
    () =>
      independentLayers.map((_, index) =>
        createMotionConfig({
          speed: clamp01(resolved.speed + 0.08 + index * 0.04),
          wobble: clamp01(resolved.wobble + 0.08 + index * 0.03),
          spinMultiplier: Math.max(0.46, 0.68 - index * 0.06),
          wobbleMultiplier: 1.14 + index * 0.08,
          durationMultiplier: Math.max(0.66, 0.84 - index * 0.05),
        }),
      ),
    [independentLayers, resolved.speed, resolved.wobble],
  )

  const wrapperStyle =
    typeof size === 'number'
      ? ({
          width: `${size}px`,
          height: `${size}px`,
        } satisfies React.CSSProperties)
      : ({
          width: size,
          aspectRatio: '1 / 1',
        } satisfies React.CSSProperties)

  const resolvedLogoScale = BASE_LOGO_SCALE * clamp(logoScale, 0, 3)

  return (
    <div className="relative" style={wrapperStyle} data-testid="landing-process-ring-graphic">
      <svg viewBox="0 0 720 720" className="h-full w-full overflow-visible" aria-hidden="true">
        <defs>
          <linearGradient id={refId('washMint')} x1="110" y1="604" x2="604" y2="114" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={ringColors.accent} />
            <stop offset="38%" stopColor={ringColors.washMint1} />
            <stop offset="74%" stopColor={ringColors.washMint2} />
            <stop offset="100%" stopColor={ringColors.primary} />
          </linearGradient>
          <linearGradient id={refId('washBlue')} x1="600" y1="610" x2="154" y2="108" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={ringColors.washBlue1} />
            <stop offset="28%" stopColor={ringColors.washBlue2} />
            <stop offset="72%" stopColor={ringColors.washBlue3} />
            <stop offset="100%" stopColor={ringColors.accent} />
          </linearGradient>
          <linearGradient id={refId('mintStroke')} x1="110" y1="602" x2="600" y2="116" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={ringColors.accent} />
            <stop offset="36%" stopColor={ringColors.accent} />
            <stop offset="76%" stopColor={ringColors.midBridge} />
            <stop offset="100%" stopColor={ringColors.primary} />
          </linearGradient>
          <linearGradient
            id={refId('mintStrokeSoft')}
            x1="120"
            y1="598"
            x2="594"
            y2="120"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor={ringColors.mintSoft1} />
            <stop offset="44%" stopColor={ringColors.mintSoft2} />
            <stop offset="100%" stopColor={ringColors.mintSoft3} />
          </linearGradient>
          <linearGradient id={refId('blueStroke')} x1="592" y1="610" x2="152" y2="112" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={ringColors.primaryDeep} />
            <stop offset="30%" stopColor={ringColors.primary} />
            <stop offset="74%" stopColor={ringColors.blueBridge} />
            <stop offset="100%" stopColor={ringColors.accent} />
          </linearGradient>
          <linearGradient
            id={refId('blueStrokeSoft')}
            x1="604"
            y1="600"
            x2="132"
            y2="132"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor={ringColors.blueSoft1} />
            <stop offset="34%" stopColor={ringColors.blueSoft2} />
            <stop offset="76%" stopColor={ringColors.blueSoft3} />
            <stop offset="100%" stopColor={ringColors.blueSoft4} />
          </linearGradient>
          <linearGradient id={refId('iceStroke')} x1="132" y1="588" x2="596" y2="138" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={ringColors.ice1} />
            <stop offset="46%" stopColor={ringColors.ice2} />
            <stop offset="100%" stopColor={ringColors.ice3} />
          </linearGradient>
          <linearGradient id={refId('chalkStroke')} x1="140" y1="584" x2="586" y2="144" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={ringColors.chalk1} />
            <stop offset="100%" stopColor={ringColors.chalk2} />
          </linearGradient>
          <linearGradient id={refId('ghostStroke')} x1="124" y1="598" x2="590" y2="130" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={ringColors.ghost1} />
            <stop offset="100%" stopColor={ringColors.ghost2} />
          </linearGradient>
          <filter id={refId('softRibbon')} x="-18%" y="-18%" width="136%" height="136%">
            <feGaussianBlur stdDeviation="0.72" />
          </filter>
          <filter id={refId('traceSoft')} x="-18%" y="-18%" width="136%" height="136%">
            <feGaussianBlur stdDeviation="0.18" />
          </filter>
          <filter id={refId('controlledGlow')} x="-22%" y="-22%" width="144%" height="144%">
            <feGaussianBlur stdDeviation="3.1" />
          </filter>
        </defs>

        {glowLayers.length > 0 && (
          <g>
            {glowLayers.map((layer) => (
              <LayerPath key={layer.id} layer={layer} />
            ))}
          </g>
        )}
        {washLayers.length > 0 && (
          <AnimatedLayerGroup layers={washLayers} config={washMotion} reducedMotion={motionDisabled} />
        )}
        {groupedLayers.outer.length > 0 && (
          <AnimatedLayerGroup layers={groupedLayers.outer} config={outerMotion} reducedMotion={motionDisabled} />
        )}
        {groupedLayers.core.length > 0 && (
          <AnimatedLayerGroup layers={groupedLayers.core} config={coreMotion} reducedMotion={motionDisabled} />
        )}
        {independentLayers.map((layer, index) => (
          <AnimatedLayerGroup
            key={layer.id}
            layers={[layer]}
            config={independentMotionConfigs[index] ?? coreMotion}
            reducedMotion={motionDisabled}
          />
        ))}
      </svg>

      {logoSrc ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className="flex items-center justify-center p-2"
            style={{
              width: `${resolvedLogoScale * 100}%`,
              height: `${resolvedLogoScale * 100}%`,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoSrc} alt={logoAlt} className="max-h-full max-w-full object-contain" />
          </div>
        </div>
      ) : null}
    </div>
  )
}

function ResponsiveStepCard({ step, bulletColor }: { step: OrbitStepLayout; bulletColor: string }) {
  return (
    <li
      className="rounded-[28px] border border-border/70 bg-background/90 p-5 shadow-[0_12px_30px_rgba(7,1,25,0.05)] lg:absolute lg:[top:var(--orbit-top)] lg:[left:var(--orbit-left)] lg:z-20 lg:[width:var(--orbit-width)] lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none"
      style={
        {
          '--orbit-left': `${step.left}px`,
          '--orbit-top': `${step.top}px`,
          '--orbit-width': `${step.width}px`,
        } as React.CSSProperties
      }
    >
      <div className="flex items-start gap-4">
        <span className="mt-3 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: bulletColor }} />
        <div className="flex min-w-0 gap-3">
          <span className="text-4xl leading-none font-bold tracking-[-0.06em] text-foreground sm:text-[42px]">
            {step.index + 1}.
          </span>
          <div className="min-w-0 pt-1">
            <Heading as="h3" size="h6" align="left" className="text-lg leading-6">
              {step.title}
            </Heading>
            <p className="mt-2 text-sm leading-6 text-muted-foreground lg:mt-1 lg:text-[13px]">{step.body}</p>
          </div>
        </div>
      </div>
    </li>
  )
}

function ResponsiveOrbitScene({
  ringSize,
  orbitMargin,
  startAngle,
  endAngle,
  steps,
  bulletColor,
  ringProps,
  motionActive,
}: {
  ringSize: number
  orbitMargin: number
  startAngle: number
  endAngle: number
  steps: ReadonlyArray<LandingProcessRingStep>
  bulletColor: string
  ringProps: Omit<OrganicRingGraphicProps, 'size'>
  motionActive: boolean
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const sceneWidth = Math.max(SCENE_MIN_WIDTH, ringSize + SCENE_PADDING_X * 2)
  const sceneHeight = Math.max(SCENE_MIN_HEIGHT, ringSize + SCENE_PADDING_Y * 2)
  const ringLeft = sceneWidth / 2 - ringSize / 2
  const ringTop = sceneHeight / 2 - ringSize / 2
  const stepLayouts = useMemo(
    () =>
      buildProcessOrbitLayout({
        steps,
        startAngle,
        endAngle,
        ringSize,
        orbitMargin,
        sceneWidth,
        sceneHeight,
      }),
    [endAngle, orbitMargin, ringSize, sceneHeight, sceneWidth, startAngle, steps],
  )
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    if (typeof ResizeObserver === 'undefined' || !containerRef.current) return

    const updateScale = () => {
      const nextWidth = containerRef.current?.clientWidth ?? sceneWidth
      setScale(Math.min(nextWidth / sceneWidth, 1))
    }

    updateScale()

    const resizeObserver = new ResizeObserver(() => {
      updateScale()
    })

    resizeObserver.observe(containerRef.current)

    return () => resizeObserver.disconnect()
  }, [sceneWidth])

  const sceneVariables = {
    '--ring-scene-width': `${sceneWidth}px`,
    '--ring-scene-height': `${sceneHeight}px`,
    '--ring-scene-scaled-width': `${sceneWidth * scale}px`,
    '--ring-scene-scaled-height': `${sceneHeight * scale}px`,
    '--ring-scene-scale': String(scale),
    '--ring-size': `${ringSize}px`,
    '--ring-left': `${ringLeft}px`,
    '--ring-top': `${ringTop}px`,
  } as React.CSSProperties

  return (
    <div
      ref={containerRef}
      className="w-full overflow-hidden"
      data-testid="landing-process-ring-scene"
      style={sceneVariables}
    >
      <div className="mx-auto w-full max-w-[var(--ring-size)] lg:[width:var(--ring-scene-scaled-width)] lg:[max-width:none]">
        <div className="relative lg:[height:var(--ring-scene-scaled-height)]">
          <div className="w-full lg:absolute lg:top-0 lg:left-1/2 lg:[height:var(--ring-scene-height)] lg:[width:var(--ring-scene-width)] lg:[transform-origin:top_center] lg:[transform:translateX(-50%)_scale(var(--ring-scene-scale))]">
            <div className="relative mx-auto aspect-square w-full max-w-[var(--ring-size)] lg:absolute lg:[top:var(--ring-top)] lg:[left:var(--ring-left)] lg:[height:var(--ring-size)] lg:[width:var(--ring-size)]">
              <OrganicRingGraphic {...ringProps} size="100%" motionActive={motionActive} />
            </div>

            <ol
              className="mt-8 space-y-4 lg:absolute lg:inset-0 lg:mt-0 lg:space-y-0"
              aria-label="Patient onboarding steps"
              data-testid="landing-process-ring-steps"
            >
              {stepLayouts.map((step) => (
                <ResponsiveStepCard key={step.id} step={step} bulletColor={bulletColor} />
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}

export const LandingProcessRing: React.FC<LandingProcessRingProps> = ({
  title,
  size = DEFAULT_SIZE,
  preset = 'balanced',
  palette = 'brand',
  accentColor,
  primaryColor,
  vibrancy = 0.5,
  colorBalance = 0.5,
  organicness,
  density,
  speed,
  wobble,
  glow,
  backgroundColor = DEFAULT_BACKGROUND,
  startAngle = DEFAULT_START_ANGLE,
  endAngle = DEFAULT_END_ANGLE,
  orbitMargin = DEFAULT_PROCESS_ORBIT_MARGIN,
  logoSrc = '/fmd-logo-1-dark.svg',
  logoAlt = 'findmydoc',
  logoScale = 1.7,
  steps = landingProcessRingDefaultSteps,
  className,
}) => {
  const sectionTitleId = useId().replace(/:/g, '')
  const { ref: sectionRef, isActive: motionActive } = useSectionMotionActive()
  const safeSteps = useMemo(() => steps.slice(0, MAX_PROCESS_STEPS), [steps])
  const resolvedBackgroundColor = normalizeHex(backgroundColor, DEFAULT_BACKGROUND)
  const resolvedRingColors = useMemo(
    () =>
      resolveRingColors({
        palette,
        accentColor,
        primaryColor,
        vibrancy: clamp01(vibrancy),
        colorBalance: clamp01(colorBalance),
      }),
    [accentColor, colorBalance, palette, primaryColor, vibrancy],
  )
  const sharedRingProps: Omit<OrganicRingGraphicProps, 'size'> = {
    preset,
    palette,
    accentColor,
    primaryColor,
    vibrancy,
    colorBalance,
    organicness,
    density,
    speed,
    wobble,
    glow,
    logoSrc,
    logoAlt,
    logoScale,
    motionActive,
  }

  return (
    <section
      ref={sectionRef}
      className={cn('w-full px-4 py-10 sm:px-6 sm:py-12 lg:py-14', className)}
      style={{ backgroundColor: resolvedBackgroundColor }}
      aria-label={title ? undefined : 'Patient onboarding process'}
      aria-labelledby={title ? sectionTitleId : undefined}
      data-testid="landing-process-ring"
    >
      <div className="mx-auto max-w-[1440px]">
        {title ? (
          <Heading
            id={sectionTitleId}
            as="h2"
            size="h2"
            align="center"
            className="mx-auto mb-8 max-w-4xl text-balance sm:mb-10 lg:mb-12"
          >
            {title}
          </Heading>
        ) : null}
        <ResponsiveOrbitScene
          ringSize={size}
          orbitMargin={orbitMargin}
          startAngle={startAngle}
          endAngle={endAngle}
          steps={safeSteps}
          bulletColor={resolvedRingColors.primary}
          ringProps={sharedRingProps}
          motionActive={motionActive}
        />
      </div>
    </section>
  )
}
