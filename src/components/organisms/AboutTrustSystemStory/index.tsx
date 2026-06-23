'use client'

import * as React from 'react'

import { Heading } from '@/components/atoms/Heading'

import styles from './AboutTrustSystemStory.module.css'

const storyCards = [
  {
    step: '01',
    label: 'Why',
    title: 'Patients start with uncertainty.',
    body: (
      <>
        Choosing care abroad often means piecing together clinics, credentials, prices, reviews and privacy concerns
        without a shared structure.
      </>
    ),
  },
  {
    step: '02',
    label: 'How',
    title: 'We turn trust signals into clearer decisions.',
    body: (
      <>
        findmydoc organizes provider information into comparable signals:{' '}
        <span className={styles.accentWord}>verification</span>
        {', '}
        <span className={styles.accentWord}>transparency</span>
        {', '}
        <span className={styles.accentWord}>privacy</span>
        {' and '}
        <span className={styles.accentWord}>access</span>.
      </>
    ),
  },
  {
    step: '03',
    label: 'What',
    title: 'A clearer path forward for patients and clinics.',
    body: (
      <>
        Patients can understand their options with more confidence. Clinics can show the signals that make their care
        trustworthy.
      </>
    ),
    mission: {
      title: 'This is why we build findmydoc.',
      body: 'To make trust easier to understand before care begins.',
    },
  },
] as const

const signalLabels = [
  { className: styles.labelVerification, label: 'Verification' },
  { className: styles.labelTransparency, label: 'Transparency' },
  { className: styles.labelPrivacy, label: 'Privacy' },
  { className: styles.labelAccess, label: 'Access' },
] as const

const ringLabels = [
  { className: styles.ringLabelCore, label: 'Safer decisions' },
  { className: styles.ringLabelMiddle, label: 'Verified evidence' },
  { className: styles.ringLabelOuter, label: 'Compare & request care' },
] as const

const palette = [
  { color: '#006DE5', glow: 'rgb(0 109 229 / .14)' },
  { color: '#42e2b7', glow: 'rgb(66 226 183 / .17)' },
  { color: '#07004c', glow: 'rgb(7 0 76 / .11)' },
] as const

const HOMEPAGE_RING_VERTEX_SHADER = `
  precision highp float;
  attribute vec2 position;
  attribute vec2 uv;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`

const HOMEPAGE_RING_FRAGMENT_SHADER = `
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

type Particle = {
  el: HTMLSpanElement
  group: number
  chaosX: number
  chaosY: number
  clusterJitter: number
  phase: number
  drift: number
  commonOrbitAngle?: number
}

type HomepageRingRenderer = {
  draw: (elapsedTime: number) => void
  dispose: () => void
}

type AboutTrustSystemStoryProps = {
  fixedProgress?: number
}

const RUNTIME_ACTIVATION_MARGIN_PX = 420

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function clamp01(value: number) {
  return clamp(value, 0, 1)
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

function lerpAngle(a: number, b: number, t: number) {
  const fullTurn = Math.PI * 2
  const delta = ((((b - a + Math.PI) % fullTurn) + fullTurn) % fullTurn) - Math.PI

  return a + delta * t
}

function seededRandom(seed: number) {
  const value = Math.sin(seed * 981.133) * 10000

  return value - Math.floor(value)
}

function normalizeHex(value: string | undefined, fallback: string) {
  if (!value) return fallback

  const next = value.trim()
  const short = /^#([0-9a-f]{3})$/i.exec(next)

  if (short) {
    const raw = short[1] ?? ''

    return `#${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`.toUpperCase()
  }

  return /^#([0-9a-f]{6})$/i.test(next) ? next.toUpperCase() : fallback
}

function hexToRgb(hex: string): RGB {
  const normalized = normalizeHex(hex, '#000000').slice(1)

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  }
}

function rgbToVector({ r, g, b }: RGB): [number, number, number] {
  return [r / 255, g / 255, b / 255]
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

  return { h: hue / 6, s: saturation, l: lightness }
}

function hslToRgb({ h, s, l }: HSL): RGB {
  if (s === 0) return { r: l * 255, g: l * 255, b: l * 255 }

  const hueToRgb = (p: number, q: number, input: number) => {
    let next = input

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

  return hslToRgb({ h: hsl.h, s: clamp01(hsl.s * amount), l: clamp01(hsl.l) })
}

function adjustLightness(rgb: RGB, amount: number) {
  const hsl = rgbToHsl(rgb)

  return hslToRgb({ h: hsl.h, s: hsl.s, l: clamp01(hsl.l + amount) })
}

function resolveHomepageRingColors() {
  const accentBase = hexToRgb('#42E2B7')
  const primaryBase = hexToRgb('#006DE5')
  const vibrancy = 1
  const colorBalance = 0.4
  const haloSaturation = 0.5
  const haloLightness = 0.55
  const accent = saturate(accentBase, lerp(0.92, 1.24, vibrancy))
  const primary = saturate(primaryBase, lerp(0.94, 1.28, vibrancy))
  const bridge = mixRgb(primary, accent, lerp(0.34, 0.66, 1 - colorBalance))
  const deep = adjustLightness(mixRgb(primary, bridge, 0.24), -0.22)
  const haloBase = adjustLightness(mixRgb(accent, bridge, 0.34), lerp(-0.08, 0.265, haloLightness))
  const haloSaturationBoost = lerp(0.84, 1.16, haloSaturation)
  const halo = saturate(haloBase, lerp(1.08, 1.24, vibrancy) * haloSaturationBoost)

  return {
    accentVec: rgbToVector(accent),
    primaryVec: rgbToVector(primary),
    bridgeVec: rgbToVector(bridge),
    deepVec: rgbToVector(deep),
    haloVec: rgbToVector(halo),
  }
}

function createHomepageShader(gl: WebGLRenderingContext, type: number, source: string) {
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

function createHomepageProgram(gl: WebGLRenderingContext, vertexSource: string, fragmentSource: string) {
  const vertexShader = createHomepageShader(gl, gl.VERTEX_SHADER, vertexSource)
  const fragmentShader = createHomepageShader(gl, gl.FRAGMENT_SHADER, fragmentSource)

  if (!vertexShader || !fragmentShader) {
    if (vertexShader) gl.deleteShader(vertexShader)
    if (fragmentShader) gl.deleteShader(fragmentShader)

    return null
  }

  const program = gl.createProgram()

  if (!program) return null

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

function initHomepageRingRenderer(
  container: HTMLDivElement,
  fallback: HTMLDivElement | null,
  fallbackClassName: string,
): HomepageRingRenderer {
  let disposed = false
  let resizeObserver: ResizeObserver | null = null
  let removeResizeListener: () => void = () => undefined
  const canvas = document.createElement('canvas')
  const colors = resolveHomepageRingColors()

  canvas.setAttribute('aria-hidden', 'true')
  container.appendChild(canvas)

  const disposeBase = () => {
    resizeObserver?.disconnect()
    removeResizeListener()
    canvas.removeEventListener('webglcontextlost', handleContextLost)
    canvas.removeEventListener('webglcontextcreationerror', showCanvasFallback)

    if (container.contains(canvas)) {
      container.removeChild(canvas)
    }
  }

  function showCanvasFallback() {
    fallback?.classList.add(fallbackClassName)
  }

  function handleContextLost(event: Event) {
    event.preventDefault()
    disposed = true
    showCanvasFallback()
  }

  canvas.addEventListener('webglcontextlost', handleContextLost)
  canvas.addEventListener('webglcontextcreationerror', showCanvasFallback)

  const gl = canvas.getContext('webgl', {
    alpha: true,
    antialias: false,
    depth: false,
    powerPreference: 'default',
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
    stencil: false,
  })

  if (!gl) {
    showCanvasFallback()

    return {
      draw: () => undefined,
      dispose: disposeBase,
    }
  }

  const program = createHomepageProgram(gl, HOMEPAGE_RING_VERTEX_SHADER, HOMEPAGE_RING_FRAGMENT_SHADER)

  if (!program) {
    showCanvasFallback()

    return {
      draw: () => undefined,
      dispose: disposeBase,
    }
  }

  const positions = new Float32Array([-1, -1, 3, -1, -1, 3])
  const uvs = new Float32Array([0, 0, 2, 0, 0, 2])
  const positionBuffer = gl.createBuffer()
  const uvBuffer = gl.createBuffer()

  if (!positionBuffer || !uvBuffer) {
    showCanvasFallback()

    return {
      draw: () => undefined,
      dispose: () => {
        gl.deleteProgram(program)
        disposeBase()
      },
    }
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)
  gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW)

  const locations = {
    position: gl.getAttribLocation(program, 'position'),
    uv: gl.getAttribLocation(program, 'uv'),
    resolution: gl.getUniformLocation(program, 'iResolution'),
    time: gl.getUniformLocation(program, 'iTime'),
    speed: gl.getUniformLocation(program, 'uSpeed'),
    organicness: gl.getUniformLocation(program, 'uOrganicness'),
    density: gl.getUniformLocation(program, 'uDensity'),
    wobble: gl.getUniformLocation(program, 'uWobble'),
    glow: gl.getUniformLocation(program, 'uGlow'),
    accent: gl.getUniformLocation(program, 'uAccent'),
    primary: gl.getUniformLocation(program, 'uPrimary'),
    bridge: gl.getUniformLocation(program, 'uBridge'),
    deep: gl.getUniformLocation(program, 'uDeep'),
    halo: gl.getUniformLocation(program, 'uHalo'),
    lightSurface: gl.getUniformLocation(program, 'uLightSurface'),
    flareTint: gl.getUniformLocation(program, 'uFlareTint'),
    lightSurfaceFade: gl.getUniformLocation(program, 'uLightSurfaceFade'),
  }

  const updateCanvasSize = () => {
    if (disposed) return

    const canvasWidth = Math.max(1, Math.round(container.clientWidth))
    const canvasHeight = Math.max(1, Math.round(container.clientHeight))
    const dpr = Math.min(window.devicePixelRatio || 1, window.innerWidth <= 767 ? 1.25 : 1.75)

    canvas.width = Math.max(1, Math.round(canvasWidth * dpr))
    canvas.height = Math.max(1, Math.round(canvasHeight * dpr))
    canvas.style.width = `${canvasWidth}px`
    canvas.style.height = `${canvasHeight}px`
    gl.viewport(0, 0, canvas.width, canvas.height)
  }

  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(updateCanvasSize)
    resizeObserver.observe(container)
  } else {
    window.addEventListener('resize', updateCanvasSize, { passive: true })
    removeResizeListener = () => window.removeEventListener('resize', updateCanvasSize)
  }

  updateCanvasSize()

  const draw = (elapsedTime: number) => {
    if (disposed) return

    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.useProgram(program)
    gl.uniform3f(locations.resolution, canvas.width, canvas.height, canvas.width / Math.max(canvas.height, 1))
    gl.uniform1f(locations.time, elapsedTime)
    gl.uniform1f(locations.speed, lerp(0.18, 1.18, 0.15))
    gl.uniform1f(locations.organicness, 0)
    gl.uniform1f(locations.density, 0.58)
    gl.uniform1f(locations.wobble, 0.62)
    gl.uniform1f(locations.glow, 1)
    gl.uniform3f(locations.accent, ...colors.accentVec)
    gl.uniform3f(locations.primary, ...colors.primaryVec)
    gl.uniform3f(locations.bridge, ...colors.bridgeVec)
    gl.uniform3f(locations.deep, ...colors.deepVec)
    gl.uniform3f(locations.halo, ...colors.haloVec)
    gl.uniform1f(locations.lightSurface, 1)
    gl.uniform1f(locations.flareTint, 0.55)
    gl.uniform1f(locations.lightSurfaceFade, 0.8)

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
    gl.enableVertexAttribArray(locations.position)
    gl.vertexAttribPointer(locations.position, 2, gl.FLOAT, false, 0, 0)
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer)
    gl.enableVertexAttribArray(locations.uv)
    gl.vertexAttribPointer(locations.uv, 2, gl.FLOAT, false, 0, 0)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  return {
    draw,
    dispose: () => {
      disposed = true
      gl.deleteBuffer(positionBuffer)
      gl.deleteBuffer(uvBuffer)
      gl.deleteProgram(program)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
      disposeBase()
    },
  }
}

function normalizeRadians(angle: number) {
  const fullTurn = Math.PI * 2

  return ((angle % fullTurn) + fullTurn) % fullTurn
}

function getBuildAngle(particle: Particle, index: number, particleCount: number) {
  const ringIndex = Math.floor(index / 3)
  const ringCount = Math.ceil(particleCount / 3)
  const baseAngle = (ringIndex / ringCount) * Math.PI * 2 + particle.group * 0.22

  return normalizeRadians(baseAngle + (particle.clusterJitter - 0.5) * 0.25)
}

export const AboutTrustSystemStory: React.FC<AboutTrustSystemStoryProps> = ({ fixedProgress }) => {
  const [runtimeEnabled, setRuntimeEnabled] = React.useState(() => typeof fixedProgress === 'number')
  const storyRef = React.useRef<HTMLElement | null>(null)
  const shellRef = React.useRef<HTMLDivElement | null>(null)
  const copyStackRef = React.useRef<HTMLDivElement | null>(null)
  const galaxyAreaRef = React.useRef<HTMLDivElement | null>(null)
  const progressBarRef = React.useRef<HTMLDivElement | null>(null)
  const railRef = React.useRef<HTMLDivElement | null>(null)
  const ringsRef = React.useRef<SVGSVGElement | null>(null)
  const centerOrbRef = React.useRef<HTMLDivElement | null>(null)
  const centerContentRef = React.useRef<HTMLDivElement | null>(null)
  const ambientGlowRef = React.useRef<HTMLDivElement | null>(null)
  const homepageRingLayerRef = React.useRef<HTMLDivElement | null>(null)
  const homepageRingCanvasRef = React.useRef<HTMLDivElement | null>(null)
  const homepageRingFallbackRef = React.useRef<HTMLDivElement | null>(null)
  const cardRefs = React.useRef<Array<HTMLElement | null>>([])
  const stepRefs = React.useRef<Array<HTMLDivElement | null>>([])
  const signalLabelRefs = React.useRef<Array<HTMLDivElement | null>>([])
  const ringLabelRefs = React.useRef<Array<HTMLDivElement | null>>([])

  React.useEffect(() => {
    if (typeof fixedProgress === 'number') {
      setRuntimeEnabled(true)

      return
    }

    if (runtimeEnabled) return

    const story = storyRef.current

    if (!story) return

    let disposed = false
    const activateRuntime = () => {
      if (!disposed) setRuntimeEnabled(true)
    }
    const rect = story.getBoundingClientRect()
    const isNearViewport =
      rect.top <= window.innerHeight + RUNTIME_ACTIVATION_MARGIN_PX && rect.bottom >= -RUNTIME_ACTIVATION_MARGIN_PX

    if (isNearViewport || typeof IntersectionObserver === 'undefined') {
      activateRuntime()

      return
    }

    const activationObserver = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return

        activateRuntime()
        activationObserver.disconnect()
      },
      { rootMargin: `${RUNTIME_ACTIVATION_MARGIN_PX}px 0px`, threshold: 0 },
    )

    activationObserver.observe(story)

    return () => {
      disposed = true
      activationObserver.disconnect()
    }
  }, [fixedProgress, runtimeEnabled])

  React.useEffect(() => {
    if (!runtimeEnabled) return

    const story = storyRef.current
    const shell = shellRef.current
    const copyStack = copyStackRef.current
    const galaxyArea = galaxyAreaRef.current
    const progressBar = progressBarRef.current
    const rail = railRef.current
    const rings = ringsRef.current
    const centerOrb = centerOrbRef.current
    const centerContent = centerContentRef.current
    const ambientGlow = ambientGlowRef.current
    const homepageRingLayer = homepageRingLayerRef.current
    const homepageRingCanvas = homepageRingCanvasRef.current
    const homepageRingFallback = homepageRingFallbackRef.current
    const cards = cardRefs.current.filter(Boolean) as HTMLElement[]
    const steps = stepRefs.current.filter(Boolean) as HTMLDivElement[]
    const labels = signalLabelRefs.current
    const outcomeLabels = ringLabelRefs.current

    if (!story || !shell || !copyStack || !galaxyArea || !rings || !centerOrb || cards.length === 0) return

    const isActiveClass = styles.isActive!
    const isFadingClass = styles.isFading!
    const isLargeClass = styles.isLarge!
    const particlesHiddenClass = styles.particlesHidden!
    const showClass = styles.show!
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const staticProgress = typeof fixedProgress === 'number' ? clamp01(fixedProgress) : null
    const progressIsStatic = staticProgress !== null
    const shouldRunContinuousLoop = !reducedMotion && !progressIsStatic
    const shouldRenderWebGl = !reducedMotion || progressIsStatic
    const particles: Particle[] = []
    const particleCount = window.innerWidth <= 767 ? 52 : window.innerWidth <= 1179 ? 78 : 118
    let activeCardIndex = Math.max(
      0,
      cards.findIndex((card) => card.classList.contains(isActiveClass)),
    )
    let pendingCardIndex = activeCardIndex
    let cardSwapTimer = 0
    let progress = 0
    let visualProgress = 0
    let width = 1
    let height = 1
    let raf = 0
    let time = 0
    let ringStartedAt = 0
    let ringTimeSeconds = 0
    let particleOrbitRotation = 0
    let sectionMotionActive = true
    let lastFrameAt = 0

    const setActiveCard = (nextIndex: number) => {
      if (nextIndex === activeCardIndex && !copyStack.classList.contains(isFadingClass)) return
      if (nextIndex === pendingCardIndex && copyStack.classList.contains(isFadingClass)) return

      pendingCardIndex = nextIndex

      if (reducedMotion || progressIsStatic) {
        cards.forEach((card, index) => {
          const isActive = index === nextIndex

          card.classList.toggle(isActiveClass, isActive)
          card.dataset.active = String(isActive)
        })
        activeCardIndex = nextIndex
        copyStack.classList.remove(isFadingClass)

        return
      }

      copyStack.classList.add(isFadingClass)

      if (cardSwapTimer) window.clearTimeout(cardSwapTimer)

      cardSwapTimer = window.setTimeout(() => {
        cards.forEach((card, index) => {
          const isActive = index === pendingCardIndex

          card.classList.toggle(isActiveClass, isActive)
          card.dataset.active = String(isActive)
        })
        activeCardIndex = pendingCardIndex
        requestAnimationFrame(() => copyStack.classList.remove(isFadingClass))
      }, 80)
    }

    const makeParticle = (index: number): Particle => {
      const group = index % 3
      const el = document.createElement('span')

      el.className = `${styles.particle}${seededRandom(index + 18) > 0.84 ? ` ${isLargeClass}` : ''}`
      el.setAttribute('aria-hidden', 'true')
      el.style.setProperty('--size', `${lerp(5, 9, seededRandom(index + 11)).toFixed(1)}px`)
      el.style.setProperty('--particle-color', palette[group]?.color ?? palette[0].color)
      el.style.setProperty('--particle-glow', palette[group]?.glow ?? palette[0].glow)
      galaxyArea.appendChild(el)

      return {
        el,
        group,
        chaosX: seededRandom(index + 1),
        chaosY: seededRandom(index + 777),
        clusterJitter: seededRandom(index + 204),
        phase: seededRandom(index + 83) * Math.PI * 2,
        drift: lerp(0.55, 1.8, seededRandom(index + 341)),
      }
    }

    const assignCommonOrbitAngles = () => {
      const fullTurn = Math.PI * 2
      const slotAngle = fullTurn / particleCount
      const ordered = particles
        .map((particle, index) => ({
          particle,
          angle: getBuildAngle(particle, index, particleCount),
        }))
        .sort((a, b) => a.angle - b.angle)

      let sumSin = 0
      let sumCos = 0

      ordered.forEach((entry, rank) => {
        const difference = entry.angle - rank * slotAngle
        sumSin += Math.sin(difference)
        sumCos += Math.cos(difference)
      })

      const sharedOffset = Math.atan2(sumSin, sumCos)

      ordered.forEach((entry, rank) => {
        entry.particle.commonOrbitAngle = normalizeRadians(sharedOffset + rank * slotAngle)
      })
    }

    const setupParticles = () => {
      for (let i = 0; i < particleCount; i += 1) {
        particles.push(makeParticle(i))
      }

      assignCommonOrbitAngles()
    }

    const updateScroll = () => {
      if (progressIsStatic) {
        progress = staticProgress

        return
      }

      const rect = story.getBoundingClientRect()
      const maxScroll = Math.max(1, story.offsetHeight - window.innerHeight)
      progress = clamp(-rect.top / maxScroll, 0, 1)
    }

    const getTargets = (particle: Particle, index: number) => {
      const centerX = width / 2
      const centerY = height / 2
      const min = Math.min(width, height)
      const chaos = {
        x: lerp(width * 0.05, width * 0.95, particle.chaosX),
        y: lerp(height * 0.1, height * 0.9, particle.chaosY),
      }
      const ringIndex = Math.floor(index / 3)
      const ringCount = Math.ceil(particleCount / 3)
      const ringAngle = (ringIndex / ringCount) * Math.PI * 2 + particle.group * 0.22
      const buildRadius = min * [0.06, 0.12, 0.18][particle.group]! + (particle.clusterJitter - 0.5) * min * 0.025
      const buildAngle = ringAngle + (particle.clusterJitter - 0.5) * 0.25
      const cluster = {
        x: centerX + Math.cos(buildAngle) * buildRadius,
        y: centerY + Math.sin(buildAngle) * buildRadius,
      }

      return {
        chaos,
        cluster,
        clusterAngle: buildAngle,
        clusterRadius: buildRadius,
        commonAngle: particle.commonOrbitAngle ?? normalizeRadians(buildAngle),
      }
    }

    const updateParticles = (p: number) => {
      const toCluster = smoothstep(0.04, 0.64, p)
      const clearCore = smoothstep(0.62, 0.76, p)
      const toCommonOrbit = smoothstep(0.72, 0.92, p)
      const radialExpansion = smoothstep(0.62, 0.92, p)
      const chaosEnergy = 1 - smoothstep(0.1, 0.7, p)
      const settle = smoothstep(0.62, 0.92, p)
      const particleFade = 1 - smoothstep(0.84, 0.94, p)
      const shaderSize = homepageRingLayer?.clientWidth || Math.min(width, height) * 0.82
      const commonRadius = shaderSize * 0.43
      const coreClearance = Math.max(centerOrb.offsetWidth * 0.58, Math.min(width, height) * 0.2)
      const centerX = width / 2
      const centerY = height / 2

      particles.forEach((particle, index) => {
        const targets = getTargets(particle, index)
        let x = lerp(targets.chaos.x, targets.cluster.x, toCluster)
        let y = lerp(targets.chaos.y, targets.cluster.y, toCluster)
        const commonAngle = targets.commonAngle + particleOrbitRotation
        const expandedRadius = Math.max(targets.clusterRadius, coreClearance)
        const clearedRadius = lerp(targets.clusterRadius, expandedRadius, clearCore)
        const radialRadius = lerp(clearedRadius, commonRadius, toCommonOrbit)
        const radialAngle = lerpAngle(targets.clusterAngle, commonAngle, toCommonOrbit)
        const radialX = centerX + Math.cos(radialAngle) * radialRadius
        const radialY = centerY + Math.sin(radialAngle) * radialRadius

        x = lerp(x, radialX, radialExpansion)
        y = lerp(y, radialY, radialExpansion)

        const driftFade = 1 - smoothstep(0.58, 0.74, p)
        const drift = reducedMotion ? 0 : (7 * chaosEnergy + 0.8 * (1 - settle)) * driftFade

        x += Math.cos(time * 0.001 * particle.drift + particle.phase) * drift
        y += Math.sin(time * 0.0009 * particle.drift + particle.phase) * drift

        const scale = lerp(1.18, 0.84, smoothstep(0.68, 0.94, p))
        const opacity = lerp(0.68, 0.96, settle) * particleFade

        particle.el.style.setProperty('--x', `${x.toFixed(1)}px`)
        particle.el.style.setProperty('--y', `${y.toFixed(1)}px`)
        particle.el.style.setProperty('--particle-scale', scale.toFixed(3))
        particle.el.style.setProperty('--particle-opacity', opacity.toFixed(3))
      })
    }

    const updateDom = (p: number) => {
      const active = p < 0.28 ? 0 : p < 0.64 ? 1 : 2

      setActiveCard(active)
      steps.forEach((step, index) => {
        const isActive = index === active

        step.classList.toggle(isActiveClass, isActive)
        step.dataset.active = String(isActive)
      })

      if (progressBar) progressBar.style.width = `${(p * 100).toFixed(2)}%`

      if (rail) {
        const railOpacity = 0.62 * (1 - smoothstep(0.84, 0.97, p))
        rail.style.opacity = railOpacity.toFixed(3)
      }

      const guideRingIn = smoothstep(0.5, 0.64, p)
      const guideRingOut = 1 - smoothstep(0.7, 0.79, p)
      const ringOpacity = 0.28 * guideRingIn * guideRingOut

      rings.style.setProperty('--rings-opacity', ringOpacity.toFixed(3))
      rings.style.setProperty('--rings-scale', lerp(0.94, 1, guideRingIn).toFixed(3))

      const shaderReveal = smoothstep(0.82, 0.985, p)

      homepageRingLayer?.style.setProperty('--homepage-ring-opacity', shaderReveal.toFixed(3))
      if (!shouldRenderWebGl) homepageRingFallback?.classList.toggle(showClass, shaderReveal > 0)

      if (ambientGlow) {
        ambientGlow.style.opacity = (1 - shaderReveal).toFixed(3)
      }

      const centerReveal = smoothstep(0.72, 0.82, p)
      const centerScale = lerp(0.9, 1, centerReveal)

      centerOrb.style.setProperty('--center-opacity', centerReveal.toFixed(3))
      centerOrb.style.setProperty('--center-scale', centerScale.toFixed(3))
      centerContent?.style.setProperty('--center-opacity', centerReveal.toFixed(3))
      centerContent?.style.setProperty('--center-scale', centerScale.toFixed(3))

      labels[0]?.classList.toggle(showClass, p > 0.3 && p < 0.61)
      labels[1]?.classList.toggle(showClass, p > 0.33 && p < 0.62)
      labels[2]?.classList.toggle(showClass, p > 0.36 && p < 0.63)
      labels[3]?.classList.toggle(showClass, p > 0.39 && p < 0.64)
      const labelOneVisible = p > 0.7
      const labelTwoVisible = p > 0.73
      const labelThreeVisible = p > 0.76

      outcomeLabels[0]?.classList.toggle(showClass, labelOneVisible)
      outcomeLabels[0]?.toggleAttribute('data-visible', labelOneVisible)
      outcomeLabels[1]?.classList.toggle(showClass, labelTwoVisible)
      outcomeLabels[1]?.toggleAttribute('data-visible', labelTwoVisible)
      outcomeLabels[2]?.classList.toggle(showClass, labelThreeVisible)
      outcomeLabels[2]?.toggleAttribute('data-visible', labelThreeVisible)
      galaxyArea.classList.toggle(particlesHiddenClass, p > 0.935)
    }

    const updateVisual = (force = false, deltaSeconds = 1 / 60) => {
      const damping = 1 - Math.exp(-12 * Math.max(0, deltaSeconds))
      visualProgress = force || reducedMotion || progressIsStatic ? progress : lerp(visualProgress, progress, damping)

      if (!reducedMotion && !progressIsStatic && !force) {
        const orbitRotationStrength = smoothstep(0.78, 0.9, visualProgress)
        particleOrbitRotation += deltaSeconds * 0.09 * orbitRotationStrength
      }

      updateParticles(visualProgress)
      updateDom(progress)
    }

    const resize = () => {
      if (window.innerWidth >= 768 && shell && copyStack) {
        const shellRect = shell.getBoundingClientRect()
        const copyRect = copyStack.getBoundingClientRect()
        const copyRight = clamp(copyRect.right - shellRect.left, 0, shellRect.width)
        const availableCenter = copyRight + (shellRect.width - copyRight) / 2

        galaxyArea.style.setProperty('--galaxy-center-x', `${availableCenter.toFixed(1)}px`)
      } else {
        galaxyArea.style.removeProperty('--galaxy-center-x')
      }

      const rect = galaxyArea.getBoundingClientRect()

      width = Math.max(1, rect.width)
      height = Math.max(1, rect.height)
      updateScroll()
      updateVisual(true)
    }

    const stopLoop = () => {
      if (raf) cancelAnimationFrame(raf)
      raf = 0
      lastFrameAt = 0
    }

    const startLoop = () => {
      if (shouldRunContinuousLoop && !raf && sectionMotionActive && document.visibilityState !== 'hidden') {
        raf = requestAnimationFrame(loop)
      }
    }

    const loop = (now: number) => {
      raf = 0

      if (!sectionMotionActive || document.visibilityState === 'hidden') return

      time = now || 0

      const deltaSeconds = lastFrameAt ? Math.min(0.1, Math.max(0, (time - lastFrameAt) / 1000)) : 1 / 60

      lastFrameAt = time
      updateVisual(false, deltaSeconds)

      if (progress > 0.78 || progressIsStatic) {
        if (!ringStartedAt) ringStartedAt = time

        ringTimeSeconds = progressIsStatic ? 0 : (time - ringStartedAt) / 1000
        homepageRingRenderer.draw(ringTimeSeconds)
      }

      raf = requestAnimationFrame(loop)
    }

    const homepageRingRenderer =
      shouldRenderWebGl && homepageRingCanvas && homepageRingFallback
        ? initHomepageRingRenderer(homepageRingCanvas, homepageRingFallback, showClass)
        : {
            draw: () => undefined,
            dispose: () => undefined,
          }

    homepageRingRenderer.draw(0)
    setupParticles()
    resize()
    updateScroll()
    updateVisual(true)
    cards.forEach((card, index) => {
      card.dataset.active = String(index === activeCardIndex)
    })
    steps.forEach((step, index) => {
      step.dataset.active = String(index === activeCardIndex)
    })
    galaxyArea.classList.add(isActiveClass)

    const sectionObserver =
      shouldRunContinuousLoop && typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            ([entry]) => {
              sectionMotionActive = Boolean(entry?.isIntersecting)
              galaxyArea.classList.toggle(isActiveClass, sectionMotionActive)

              if (sectionMotionActive) startLoop()
              else stopLoop()
            },
            { rootMargin: '180px 0px', threshold: 0.01 },
          )
        : null

    sectionObserver?.observe(story)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') stopLoop()
      else startLoop()
    }

    const handleScroll = () => {
      updateScroll()

      if (shouldRunContinuousLoop) {
        startLoop()

        return
      }

      updateVisual(true)
    }

    window.addEventListener('resize', resize, { passive: true })

    if (!progressIsStatic) {
      window.addEventListener('scroll', handleScroll, { passive: true })

      if (shouldRunContinuousLoop) {
        document.addEventListener('visibilitychange', handleVisibilityChange)
        startLoop()
      }
    }

    return () => {
      stopLoop()

      if (cardSwapTimer) window.clearTimeout(cardSwapTimer)

      sectionObserver?.disconnect()
      window.removeEventListener('resize', resize)
      if (!progressIsStatic) {
        window.removeEventListener('scroll', handleScroll)
        if (shouldRunContinuousLoop) {
          document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
      }
      homepageRingRenderer.dispose()
      particles.forEach((particle) => particle.el.remove())
      homepageRingFallback?.classList.remove(showClass)
      galaxyArea.classList.remove(isActiveClass, particlesHiddenClass)
    }
  }, [fixedProgress, runtimeEnabled])

  return (
    <div className={styles.root}>
      <section
        ref={storyRef}
        className={styles.story}
        aria-label="findmydoc trust system scroll story"
        data-testid="about-trust-system-story"
      >
        <div className={styles.accessibleSummary}>
          <Heading as="h2" align="left" size="h3">
            findmydoc trust system
          </Heading>
          <ol>
            {storyCards.map((card) => (
              <li key={card.step}>
                <p>
                  <span>{card.step}</span> {card.label}
                </p>
                <Heading as="h3" align="left" size="h4">
                  {card.title}
                </Heading>
                <p>{card.body}</p>
                {'mission' in card ? (
                  <p>
                    <strong>{card.mission.title}</strong> {card.mission.body}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
          <p>
            <strong>Patient Confidence</strong> Trust at the core.
          </p>
          <ul>
            {ringLabels.map((ringLabel) => (
              <li key={ringLabel.label}>{ringLabel.label}</li>
            ))}
          </ul>
        </div>
        <div className={styles.stickyStage}>
          <div ref={shellRef} className={styles.stageShell}>
            <div ref={copyStackRef} className={styles.copyStack} aria-hidden="true">
              {storyCards.map((card, index) => (
                <article
                  key={card.step}
                  ref={(element) => {
                    cardRefs.current[index] = element
                  }}
                  className={`${styles.copyCard}${index === 0 ? ` ${styles.isActive}` : ''}`}
                  data-card={index}
                  data-active={index === 0 ? 'true' : 'false'}
                >
                  <div className={styles.kicker}>
                    <span>{card.step}</span>
                    {card.label}
                  </div>
                  <Heading as="h3" align="left" size="h3" className={styles.copyTitle}>
                    {card.title}
                  </Heading>
                  <p className={styles.copyBody}>{card.body}</p>
                  {'mission' in card ? (
                    <div className={styles.missionLine}>
                      <strong>{card.mission.title}</strong>
                      <span>{card.mission.body}</span>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>

            <div className={styles.visualStage} aria-hidden="true">
              <div ref={galaxyAreaRef} className={styles.galaxyArea}>
                <div ref={ambientGlowRef} className={styles.ambientGlow} />
                <div ref={homepageRingLayerRef} className={styles.homepageRingLayer} aria-hidden="true">
                  <div ref={homepageRingCanvasRef} className={styles.homepageRingCanvas} />
                  <div ref={homepageRingFallbackRef} className={styles.homepageRingFallback} />
                </div>
                <svg ref={ringsRef} className={styles.ringSvg} viewBox="0 0 1000 1000" aria-hidden="true">
                  <circle className={styles.ringWhat} cx="500" cy="500" r="385" />
                  <circle className={styles.ringHow} cx="500" cy="500" r="250" />
                  <circle className={styles.ringWhy} cx="500" cy="500" r="125" />
                </svg>
                <div ref={centerOrbRef} className={styles.centerOrb} aria-hidden="true" />
                <div ref={centerContentRef} className={styles.centerContent}>
                  <div className={styles.patientCore}>
                    <strong>
                      Patient
                      <br />
                      Confidence
                    </strong>
                    <span>Trust at the core</span>
                  </div>
                </div>
                <div className={styles.ringLabelLayer}>
                  {ringLabels.map((ringLabel, index) => (
                    <div
                      key={ringLabel.label}
                      ref={(element) => {
                        ringLabelRefs.current[index] = element
                      }}
                      className={`${styles.ringLabel} ${ringLabel.className}`}
                      data-ring-label={index}
                      data-visible="false"
                    >
                      {ringLabel.label}
                    </div>
                  ))}
                </div>
                {signalLabels.map((signalLabel, index) => (
                  <div
                    key={signalLabel.label}
                    ref={(element) => {
                      signalLabelRefs.current[index] = element
                    }}
                    className={`${styles.signalLabel} ${signalLabel.className}`}
                  >
                    {signalLabel.label}
                  </div>
                ))}
              </div>
            </div>

            <div ref={railRef} className={styles.rail} aria-hidden="true">
              <div>
                <div className={styles.railLabels}>
                  {storyCards.map((card, index) => (
                    <div
                      key={card.step}
                      ref={(element) => {
                        stepRefs.current[index] = element
                      }}
                      className={`${styles.railLabel}${index === 0 ? ` ${styles.isActive}` : ''}`}
                      data-step={index}
                      data-active={index === 0 ? 'true' : 'false'}
                    >
                      <span className={styles.railDot} />
                      {card.label}
                    </div>
                  ))}
                </div>
                <div className={styles.track}>
                  <div ref={progressBarRef} className={styles.progress} data-progress-bar />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <noscript>
        <div className={styles.noScript}>This preview needs JavaScript enabled for the scroll animation.</div>
      </noscript>
    </div>
  )
}
