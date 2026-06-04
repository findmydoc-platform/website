'use client'

import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'

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
  haloSaturation?: number
  haloLightness?: number
  flareTint?: number
  lightSurfaceFade?: number
}

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

type RingBaseColors = {
  accent: string
  primary: string
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

type ResolvedShaderColors = {
  accent: string
  primary: string
  bridge: string
  deep: string
  halo: string
  bullet: string
  accentVec: [number, number, number]
  primaryVec: [number, number, number]
  bridgeVec: [number, number, number]
  deepVec: [number, number, number]
  haloVec: [number, number, number]
}

type ProcessRingGraphicProps = {
  size: number | string
  preset: LandingProcessRingPreset
  palette: LandingProcessRingPalette
  backgroundColor: string
  accentColor?: string
  primaryColor?: string
  vibrancy: number
  colorBalance: number
  organicness?: number
  density?: number
  speed?: number
  wobble?: number
  glow?: number
  haloSaturation: number
  haloLightness: number
  flareTint: number
  lightSurfaceFade: number
  logoSrc?: string | null
  logoAlt: string
  logoScale: number
  motionActive?: boolean
}

const MAX_PROCESS_STEPS = 6
const DEFAULT_SIZE = 620
const DEFAULT_BACKGROUND = '#ffffff'
const DEFAULT_HALO_SATURATION = 0.5
const DEFAULT_HALO_LIGHTNESS = 0.55
const DEFAULT_FLARE_TINT = 0.55
const DEFAULT_LIGHT_SURFACE_FADE = 0.8
const DEFAULT_START_ANGLE = 60
const DEFAULT_END_ANGLE = 300
const DEFAULT_PROCESS_ORBIT_MARGIN = 146
const BASE_LOGO_SCALE = 0.34
const SCENE_PADDING_X = 380
const SCENE_PADDING_Y = 180
const SCENE_MIN_WIDTH = 1280
const SCENE_MIN_HEIGHT = 980
const MAX_CANVAS_DPR = 1.75

const DEFAULT_BRAND_COLORS: RingBaseColors = {
  accent: '#42E2B7',
  primary: '#006DE5',
}

const PALETTE_COLORS: Record<LandingProcessRingPalette, RingBaseColors> = {
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
  calm: { organicness: 0.14, density: 0.28, speed: 0.1, wobble: 0.08, glow: 0.08 },
  balanced: { organicness: 0.44, density: 0.58, speed: 0.3, wobble: 0.22, glow: 0.28 },
  wild: { organicness: 0.82, density: 0.94, speed: 0.74, wobble: 0.52, glow: 0.44 },
}

const SHADER_VERTEX = `
  precision highp float;
  attribute vec2 position;
  attribute vec2 uv;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`

const SHADER_FRAGMENT = `
  precision highp float;

  varying vec2 vUv;

  uniform float iTime;
  uniform vec3 iResolution;
  uniform vec3 uAccent;
  uniform vec3 uPrimary;
  uniform vec3 uBridge;
  uniform vec3 uDeep;
  uniform vec3 uHalo;
  uniform float uLightSurface;
  uniform float uFlareTint;
  uniform float uLightSurfaceFade;
  uniform float uSpeed;
  uniform float uOrganicness;
  uniform float uDensity;
  uniform float uWobble;
  uniform float uGlow;

  vec3 hash33(vec3 p3) {
    p3 = fract(p3 * vec3(0.1031, 0.11369, 0.13787));
    p3 += dot(p3, p3.yxz + 19.19);

    return -1.0 + 2.0 * fract(vec3(
      p3.x + p3.y,
      p3.x + p3.z,
      p3.y + p3.z
    ) * p3.zyx);
  }

  float snoise3(vec3 p) {
    const float K1 = 0.333333333;
    const float K2 = 0.166666667;

    vec3 i = floor(p + (p.x + p.y + p.z) * K1);
    vec3 d0 = p - (i - (i.x + i.y + i.z) * K2);
    vec3 e = step(vec3(0.0), d0 - d0.yzx);
    vec3 i1 = e * (1.0 - e.zxy);
    vec3 i2 = 1.0 - e.zxy * (1.0 - e);
    vec3 d1 = d0 - (i1 - K2);
    vec3 d2 = d0 - (i2 - K1);
    vec3 d3 = d0 - 0.5;

    vec4 h = max(0.6 - vec4(
      dot(d0, d0),
      dot(d1, d1),
      dot(d2, d2),
      dot(d3, d3)
    ), 0.0);

    vec4 n = h * h * h * h * vec4(
      dot(d0, hash33(i)),
      dot(d1, hash33(i + i1)),
      dot(d2, hash33(i + i2)),
      dot(d3, hash33(i + 1.0))
    );

    return dot(vec4(31.316), n);
  }

  float light1(float intensity, float attenuation, float dist) {
    return intensity / (1.0 + dist * attenuation);
  }

  float light2(float intensity, float attenuation, float dist) {
    return intensity / (1.0 + dist * dist * attenuation);
  }

  vec4 extractAlpha(vec3 colorIn) {
    float alpha = max(max(colorIn.r, colorIn.g), colorIn.b);
    return vec4(colorIn.rgb / (alpha + 0.00001), alpha);
  }

  vec4 draw(vec2 uv) {
    float time = iTime * mix(0.32, 0.86, uSpeed);
    float ang = atan(uv.y, uv.x);
    float len = length(uv);
    float inverseLength = len > 0.0 ? 1.0 / len : 0.0;

    float noiseScale = mix(0.62, 0.76, uOrganicness);
    float innerRadius = mix(0.59, 0.63, 1.0 - uDensity * 0.34);

    vec2 warpedUv = uv;
    float wobbleAmount = (0.008 + uOrganicness * 0.006) * (0.35 + uWobble * 0.65);
    warpedUv.x += wobbleAmount * sin(uv.y * mix(7.4, 10.2, uWobble) + time * 0.9);
    warpedUv.y += wobbleAmount * sin(uv.x * mix(7.0, 9.5, uWobble) - time * 0.8);

    float n0 = snoise3(vec3(warpedUv * noiseScale, time * 0.5)) * 0.5 + 0.5;
    float r0 = mix(
      mix(innerRadius, 1.0, 0.4),
      mix(innerRadius, 1.0, 0.6 + uOrganicness * 0.05),
      n0
    );

    float d0 = distance(uv, (r0 * inverseLength) * uv);
    float v0 = light1(1.0, mix(9.0, 11.5, uDensity), d0);
    v0 *= smoothstep(r0 * 1.05, r0, len);

    float colorSweep = cos(ang + time * mix(1.6, 2.2, uSpeed)) * 0.5 + 0.5;
    float orbitAngle = time * mix(-0.72, -1.14, uSpeed);
    vec2 orbPos = vec2(cos(orbitAngle), sin(orbitAngle)) * r0;
    float d = distance(uv, orbPos);
    float v1 = light2(1.25 + uGlow * 0.45, 4.2 + uGlow * 1.8, d);
    v1 *= light1(1.0, 48.0, d0);

    float v2 = smoothstep(1.0, mix(innerRadius, 1.0, n0 * 0.5), len);
    float v3 = smoothstep(innerRadius, mix(innerRadius, 1.0, 0.5), len);

    vec3 color1 = mix(uAccent, uHalo, 0.08);
    vec3 color2 = mix(uPrimary, uHalo, 0.08);
    vec3 color3Dark = mix(uDeep, uPrimary, 0.14);
    vec3 color3Light = vec3(0.0);
    vec3 color3 = mix(color3Dark, color3Light, uLightSurface);
    vec3 flareTint = mix(uAccent, uPrimary, 0.34 + colorSweep * 0.32);
    float flareTintMix = mix(0.18, 0.62, uFlareTint);
    float flareWhiteMix = mix(0.14, 0.0, uFlareTint);
    vec3 flare = mix(uHalo, flareTint, flareTintMix + uGlow * 0.08);
    flare = mix(flare, vec3(1.0), flareWhiteMix + uGlow * 0.04);
    float lightSurfaceFade = mix(0.78, 0.48, uLightSurfaceFade);

    vec3 color = mix(color1, color2, colorSweep);
    color = mix(color3, color, v0);
    color = (color + v1 * flare) * v2 * v3;
    color *= mix(1.0, lightSurfaceFade, uLightSurface * smoothstep(0.78, 1.18, len));
    color = clamp(color, 0.0, 1.0);

    return extractAlpha(color);
  }

  void main() {
    vec2 fragCoord = vUv * iResolution.xy;
    vec2 center = iResolution.xy * 0.5;
    float size = min(iResolution.x, iResolution.y);
    vec2 uv = (fragCoord - center) / size * 2.0;
    uv *= 0.94;

    float rotation = iTime * mix(0.04, 0.14, uSpeed);
    float s = sin(rotation);
    float c = cos(rotation);
    uv = vec2(c * uv.x - s * uv.y, s * uv.x + c * uv.y);

    vec4 color = draw(uv);
    gl_FragColor = vec4(color.rgb * color.a, color.a);
  }
`

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function clamp01(value: number) {
  return clamp(value, 0, 1)
}

function lerp(start: number, end: number, amount: number) {
  return start + (end - start) * amount
}

function normalizeAngle(angle: number) {
  const normalized = angle % 360
  return normalized < 0 ? normalized + 360 : normalized
}

function distributeAngles(startAngle: number, endAngle: number, count: number) {
  const start = normalizeAngle(startAngle)
  const end = normalizeAngle(endAngle)
  const sweep = end >= start ? end - start : 360 - start + end

  if (count <= 1) {
    return [normalizeAngle(start + sweep / 2)]
  }

  return Array.from({ length: count }, (_, index) => normalizeAngle(start + (sweep * index) / (count - 1)))
}

function normalizeHex(value: string | undefined, fallback: string) {
  if (!value) return fallback
  const next = value.trim()

  if (/^#([0-9a-f]{3})$/i.test(next)) {
    const [, raw] = /^#([0-9a-f]{3})$/i.exec(next) ?? []
    return raw ? `#${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`.toUpperCase() : fallback
  }

  if (/^#([0-9a-f]{6})$/i.test(next)) {
    return next.toUpperCase()
  }

  return fallback
}

function hexToRgb(hex: string): RGB {
  const normalized = normalizeHex(hex, '#000000').slice(1)

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  }
}

function rgbToHex({ r, g, b }: RGB) {
  const toHex = (channel: number) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase()
}

function rgbToVector({ r, g, b }: RGB): [number, number, number] {
  return [r / 255, g / 255, b / 255]
}

function getRelativeLuminance({ r, g, b }: RGB) {
  const toLinear = (channel: number) => {
    const normalized = channel / 255
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
  }

  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

function mixRgb(a: RGB, b: RGB, amount: number): RGB {
  const t = clamp01(amount)

  return {
    r: lerp(a.r, b.r, t),
    g: lerp(a.g, b.g, t),
    b: lerp(a.b, b.b, t),
  }
}

function rgbToHsl({ r, g, b }: RGB): HSL {
  const red = r / 255
  const green = g / 255
  const blue = b / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const lightness = (max + min) / 2

  if (max === min) {
    return { h: 0, s: 0, l: lightness }
  }

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

  return { h: hue / 6, s: saturation, l: lightness }
}

function hslToRgb({ h, s, l }: HSL): RGB {
  if (s === 0) {
    return {
      r: l * 255,
      g: l * 255,
      b: l * 255,
    }
  }

  const hueToRgb = (p: number, q: number, t: number) => {
    let next = t

    if (next < 0) next += 1
    if (next > 1) next -= 1
    if (next < 1 / 6) return p + (q - p) * 6 * next
    if (next < 1 / 2) return q
    if (next < 2 / 3) return p + (q - p) * (2 / 3 - next) * 6
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

function saturate(rgb: RGB, amount: number) {
  const hsl = rgbToHsl(rgb)

  return hslToRgb({
    h: hsl.h,
    s: clamp01(hsl.s * amount),
    l: clamp01(hsl.l),
  })
}

function adjustLightness(rgb: RGB, amount: number) {
  const hsl = rgbToHsl(rgb)

  return hslToRgb({
    h: hsl.h,
    s: hsl.s,
    l: clamp01(hsl.l + amount),
  })
}

function resolveShaderColors({
  palette,
  accentColor,
  primaryColor,
  vibrancy,
  colorBalance,
  haloSaturation,
  haloLightness,
}: {
  palette: LandingProcessRingPalette
  accentColor?: string
  primaryColor?: string
  vibrancy: number
  colorBalance: number
  haloSaturation: number
  haloLightness: number
}): ResolvedShaderColors {
  const baseColors = PALETTE_COLORS[palette]
  const accentBase = hexToRgb(palette === 'brand' ? normalizeHex(accentColor, baseColors.accent) : baseColors.accent)
  const primaryBase = hexToRgb(
    palette === 'brand' ? normalizeHex(primaryColor, baseColors.primary) : baseColors.primary,
  )
  const accent = saturate(accentBase, lerp(0.92, 1.24, clamp01(vibrancy)))
  const primary = saturate(primaryBase, lerp(0.94, 1.28, clamp01(vibrancy)))
  const bridge = mixRgb(primary, accent, lerp(0.34, 0.66, 1 - clamp01(colorBalance)))
  const deep = adjustLightness(mixRgb(primary, bridge, 0.24), -0.22)
  const haloBase = adjustLightness(mixRgb(accent, bridge, 0.34), lerp(-0.08, 0.265, clamp01(haloLightness)))
  const haloSaturationBoost = lerp(0.84, 1.16, clamp01(haloSaturation))
  const halo = saturate(haloBase, lerp(1.08, 1.24, clamp01(vibrancy)) * haloSaturationBoost)

  return {
    accent: rgbToHex(accent),
    primary: rgbToHex(primary),
    bridge: rgbToHex(bridge),
    deep: rgbToHex(deep),
    halo: rgbToHex(halo),
    bullet: rgbToHex(primary),
    accentVec: rgbToVector(accent),
    primaryVec: rgbToVector(primary),
    bridgeVec: rgbToVector(bridge),
    deepVec: rgbToVector(deep),
    haloVec: rgbToVector(halo),
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
    let left: number
    let top: number

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

function createShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) return null

  gl.shaderSource(shader, source)
  gl.compileShader(shader)

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader)
    return null
  }

  return shader
}

function createProgram(gl: WebGLRenderingContext, vertexSource: string, fragmentSource: string) {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource)
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource)

  if (!vertexShader || !fragmentShader) {
    if (vertexShader) gl.deleteShader(vertexShader)
    if (fragmentShader) gl.deleteShader(fragmentShader)
    return null
  }

  const program = gl.createProgram()

  if (!program) {
    gl.deleteShader(vertexShader)
    gl.deleteShader(fragmentShader)
    return null
  }

  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)
  gl.deleteShader(vertexShader)
  gl.deleteShader(fragmentShader)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program)
    return null
  }

  return program
}

function ProcessRingFallback({ accent, primary, bridge }: Pick<ResolvedShaderColors, 'accent' | 'primary' | 'bridge'>) {
  return (
    <div className="absolute inset-0 rounded-full">
      <div
        className="absolute inset-[10%] rounded-full"
        style={{
          background: `radial-gradient(circle at 50% 50%, transparent 56%, ${bridge}22 62%, ${primary}55 72%, ${accent}40 80%, transparent 90%)`,
        }}
      />
      <div
        className="absolute inset-[18%] rounded-full"
        style={{
          background: `radial-gradient(circle at 32% 28%, ${accent}12 0%, transparent 48%), radial-gradient(circle at 72% 74%, ${primary}16 0%, transparent 46%)`,
        }}
      />
    </div>
  )
}

function ProcessRingGraphic({
  size,
  preset,
  palette,
  backgroundColor,
  accentColor,
  primaryColor,
  vibrancy,
  colorBalance,
  organicness,
  density,
  speed,
  wobble,
  glow,
  haloSaturation,
  haloLightness,
  flareTint,
  lightSurfaceFade,
  logoSrc,
  logoAlt,
  logoScale,
  motionActive = true,
}: ProcessRingGraphicProps) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const canvasContainerRef = useRef<HTMLDivElement | null>(null)
  const [showFallback, setShowFallback] = useState(false)

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
      haloSaturation: clamp01(haloSaturation),
      haloLightness: clamp01(haloLightness),
      flareTint: clamp01(flareTint),
      lightSurfaceFade: clamp01(lightSurfaceFade),
    }
  }, [
    colorBalance,
    density,
    flareTint,
    glow,
    haloLightness,
    haloSaturation,
    lightSurfaceFade,
    organicness,
    preset,
    speed,
    vibrancy,
    wobble,
  ])

  const colors = useMemo(
    () =>
      resolveShaderColors({
        palette,
        accentColor,
        primaryColor,
        vibrancy: resolved.vibrancy,
        colorBalance: resolved.colorBalance,
        haloSaturation: resolved.haloSaturation,
        haloLightness: resolved.haloLightness,
      }),
    [
      accentColor,
      palette,
      primaryColor,
      resolved.colorBalance,
      resolved.haloLightness,
      resolved.haloSaturation,
      resolved.vibrancy,
    ],
  )
  const lightSurface = useMemo(() => {
    const rgb = hexToRgb(normalizeHex(backgroundColor, DEFAULT_BACKGROUND))
    return getRelativeLuminance(rgb) > 0.72 ? 1 : 0
  }, [backgroundColor])

  const animationEnabled = motionActive && !prefersReducedMotion && resolved.speed > 0.01

  useEffect(() => {
    if (typeof window === 'undefined') return

    const container = canvasContainerRef.current
    if (!container) return

    let disposed = false
    let rafId = 0
    let resizeObserver: ResizeObserver | null = null

    const canvas = document.createElement('canvas')
    canvas.className = 'h-full w-full'
    canvas.style.display = 'block'
    canvas.style.width = '100%'
    canvas.style.height = '100%'

    const removeCanvas = () => {
      if (container.contains(canvas)) {
        container.removeChild(canvas)
      }
    }

    const showCanvasFallback = () => {
      removeCanvas()
      setShowFallback(true)
    }

    const handleContextLost = (event: Event) => {
      event.preventDefault()
      disposed = true

      if (rafId) {
        window.cancelAnimationFrame(rafId)
      }

      showCanvasFallback()
    }

    const handleContextCreationError = () => {
      showCanvasFallback()
    }

    canvas.addEventListener('webglcontextlost', handleContextLost)
    canvas.addEventListener('webglcontextcreationerror', handleContextCreationError)

    if (!container.contains(canvas)) {
      container.appendChild(canvas)
    }

    const gl =
      canvas.getContext('webgl', {
        alpha: true,
        antialias: false,
        depth: false,
        powerPreference: 'default',
        premultipliedAlpha: true,
        preserveDrawingBuffer: false,
        stencil: false,
      }) ?? null

    if (!gl) {
      showCanvasFallback()
      return () => {
        canvas.removeEventListener('webglcontextlost', handleContextLost)
        canvas.removeEventListener('webglcontextcreationerror', handleContextCreationError)
        removeCanvas()
      }
    }

    const contextAttributes = gl.getContextAttributes()

    if (!contextAttributes || gl.isContextLost() || !contextAttributes.alpha || !contextAttributes.premultipliedAlpha) {
      showCanvasFallback()
      return () => {
        canvas.removeEventListener('webglcontextlost', handleContextLost)
        canvas.removeEventListener('webglcontextcreationerror', handleContextCreationError)
        removeCanvas()
      }
    }

    const program = createProgram(gl, SHADER_VERTEX, SHADER_FRAGMENT)

    if (!program) {
      showCanvasFallback()
      return () => {
        canvas.removeEventListener('webglcontextlost', handleContextLost)
        canvas.removeEventListener('webglcontextcreationerror', handleContextCreationError)
        removeCanvas()
      }
    }

    const positions = new Float32Array([-1, -1, 3, -1, -1, 3])
    const uvs = new Float32Array([0, 0, 2, 0, 0, 2])
    const positionBuffer = gl.createBuffer()
    const uvBuffer = gl.createBuffer()

    if (!positionBuffer || !uvBuffer) {
      gl.deleteProgram(program)
      showCanvasFallback()

      return () => {
        canvas.removeEventListener('webglcontextlost', handleContextLost)
        canvas.removeEventListener('webglcontextcreationerror', handleContextCreationError)
        removeCanvas()
      }
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW)

    const positionLocation = gl.getAttribLocation(program, 'position')
    const uvLocation = gl.getAttribLocation(program, 'uv')
    const resolutionLocation = gl.getUniformLocation(program, 'iResolution')
    const timeLocation = gl.getUniformLocation(program, 'iTime')
    const speedLocation = gl.getUniformLocation(program, 'uSpeed')
    const organicnessLocation = gl.getUniformLocation(program, 'uOrganicness')
    const densityLocation = gl.getUniformLocation(program, 'uDensity')
    const wobbleLocation = gl.getUniformLocation(program, 'uWobble')
    const glowLocation = gl.getUniformLocation(program, 'uGlow')
    const accentLocation = gl.getUniformLocation(program, 'uAccent')
    const primaryLocation = gl.getUniformLocation(program, 'uPrimary')
    const bridgeLocation = gl.getUniformLocation(program, 'uBridge')
    const deepLocation = gl.getUniformLocation(program, 'uDeep')
    const haloLocation = gl.getUniformLocation(program, 'uHalo')
    const lightSurfaceLocation = gl.getUniformLocation(program, 'uLightSurface')
    const flareTintLocation = gl.getUniformLocation(program, 'uFlareTint')
    const lightSurfaceFadeLocation = gl.getUniformLocation(program, 'uLightSurfaceFade')

    const updateCanvasSize = () => {
      const width = Math.max(1, Math.round(container.clientWidth))
      const height = Math.max(1, Math.round(container.clientHeight))
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_CANVAS_DPR)

      canvas.width = Math.max(1, Math.round(width * dpr))
      canvas.height = Math.max(1, Math.round(height * dpr))
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      gl.viewport(0, 0, canvas.width, canvas.height)
    }

    const draw = (elapsedTime: number) => {
      if (disposed) return

      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.useProgram(program)

      gl.uniform3f(resolutionLocation, canvas.width, canvas.height, canvas.width / Math.max(canvas.height, 1))
      gl.uniform1f(timeLocation, elapsedTime)
      gl.uniform1f(speedLocation, lerp(0.18, 1.18, resolved.speed))
      gl.uniform1f(organicnessLocation, resolved.organicness)
      gl.uniform1f(densityLocation, resolved.density)
      gl.uniform1f(wobbleLocation, resolved.wobble)
      gl.uniform1f(glowLocation, resolved.glow)
      gl.uniform3f(accentLocation, ...colors.accentVec)
      gl.uniform3f(primaryLocation, ...colors.primaryVec)
      gl.uniform3f(bridgeLocation, ...colors.bridgeVec)
      gl.uniform3f(deepLocation, ...colors.deepVec)
      gl.uniform3f(haloLocation, ...colors.haloVec)
      gl.uniform1f(lightSurfaceLocation, lightSurface)
      gl.uniform1f(flareTintLocation, resolved.flareTint)
      gl.uniform1f(lightSurfaceFadeLocation, resolved.lightSurfaceFade)

      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
      gl.enableVertexAttribArray(positionLocation)
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)
      gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer)
      gl.enableVertexAttribArray(uvLocation)
      gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 0, 0)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    updateCanvasSize()
    setShowFallback(false)

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        updateCanvasSize()
        if (!animationEnabled) draw(0)
      })

      resizeObserver.observe(container)
    } else {
      window.addEventListener('resize', updateCanvasSize)
    }

    let startedAt = 0

    const frame = (timestamp: number) => {
      if (disposed) return

      if (document.visibilityState === 'hidden') {
        rafId = window.requestAnimationFrame(frame)
        return
      }

      if (!startedAt) {
        startedAt = timestamp
      }

      draw((timestamp - startedAt) / 1000)
      rafId = window.requestAnimationFrame(frame)
    }

    if (animationEnabled) {
      rafId = window.requestAnimationFrame(frame)
    } else {
      draw(0)
    }

    return () => {
      disposed = true

      if (rafId) {
        window.cancelAnimationFrame(rafId)
      }

      resizeObserver?.disconnect()
      window.removeEventListener('resize', updateCanvasSize)
      gl.deleteBuffer(positionBuffer)
      gl.deleteBuffer(uvBuffer)
      gl.deleteProgram(program)

      canvas.removeEventListener('webglcontextlost', handleContextLost)
      canvas.removeEventListener('webglcontextcreationerror', handleContextCreationError)
      removeCanvas()

      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
  }, [
    animationEnabled,
    colors.accentVec,
    colors.bridgeVec,
    colors.deepVec,
    colors.haloVec,
    colors.primaryVec,
    lightSurface,
    resolved.density,
    resolved.flareTint,
    resolved.glow,
    resolved.haloLightness,
    resolved.haloSaturation,
    resolved.lightSurfaceFade,
    resolved.organicness,
    resolved.speed,
    resolved.wobble,
  ])

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
      <div ref={canvasContainerRef} className="absolute inset-0" aria-hidden="true" />
      {showFallback ? (
        <ProcessRingFallback accent={colors.accent} primary={colors.primary} bridge={colors.bridge} />
      ) : null}

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
  ringProps: Omit<ProcessRingGraphicProps, 'size'>
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
              <ProcessRingGraphic {...ringProps} size="100%" motionActive={motionActive} />
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
  haloSaturation = DEFAULT_HALO_SATURATION,
  haloLightness = DEFAULT_HALO_LIGHTNESS,
  flareTint = DEFAULT_FLARE_TINT,
  lightSurfaceFade = DEFAULT_LIGHT_SURFACE_FADE,
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
  const resolvedColors = useMemo(
    () =>
      resolveShaderColors({
        palette,
        accentColor,
        primaryColor,
        vibrancy: clamp01(vibrancy),
        colorBalance: clamp01(colorBalance),
        haloSaturation: clamp01(haloSaturation),
        haloLightness: clamp01(haloLightness),
      }),
    [accentColor, colorBalance, haloLightness, haloSaturation, palette, primaryColor, vibrancy],
  )
  const sharedRingProps: Omit<ProcessRingGraphicProps, 'size'> = {
    preset,
    palette,
    backgroundColor: resolvedBackgroundColor,
    accentColor,
    primaryColor,
    vibrancy,
    colorBalance,
    organicness,
    density,
    speed,
    wobble,
    glow,
    haloSaturation,
    haloLightness,
    flareTint,
    lightSurfaceFade,
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
          bulletColor={resolvedColors.bullet}
          ringProps={sharedRingProps}
          motionActive={motionActive}
        />
      </div>
    </section>
  )
}
