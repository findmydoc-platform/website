/**
 * generate-placeholders.mjs
 *
 * Quick generator for lightweight placeholder SVGs used in Storybook and local scaffolding.
 * This script is explicit: pass one or more sizes and one or more output directories.
 * It will create SVG files named `<prefix>-<W>-<H>.svg` (default prefix: `placeholder`).
 *
 * Usage examples:
 *   node scripts/generate-placeholders.mjs --dir src/stories/assets --size 1440x900 --size 80x80
 *   node scripts/generate-placeholders.mjs --dir public/images --size 576x968 --force
 *   node scripts/generate-placeholders.mjs 1440x900 80x80 --dir src/stories/assets
 *
 * Options:
 *   --dir <path>        Output directory (repeatable)
 *   --size <WxH>        Size like 1440x900 (repeatable). Positional sizes also supported.
 *   --prefix <string>   Filename prefix (default: placeholder)
 *   --force             Overwrite existing SVGs
 *   -h, --help          Show this help
 *
 * Notes:
 * - The generator produces modest, stylized SVGs (rounded rect, subtle gradient and blobs)
 *   intended for placeholder/visual scaffolding only.
 * - This script intentionally does NOT scan directories for existing PNGs; pass explicit
 *   sizes and directories so outputs are deterministic.
 */

import fs from 'node:fs/promises'
import path from 'node:path'

const SIZE_RE = /^(\d+)x(\d+)$/i

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function buildSvg({
  width,
  height,
  label,
  inset = 0.06,
  watermarkContent,
  watermarkOpacity = 0.5,
  watermarkScale = 0.08,
  watermarkColor,
  watermarkViewBox,
  gradStart = '#E0F2FE',
  gradEnd = '#DBEAFE',
  circle1Color = '#3B82F6',
  circle1Opacity = 0.12,
  circle2Color = '#6366F1',
  circle2Opacity = 0.1,
}) {
  const rx = clamp(Math.round(Math.min(width, height) * 0.06), 12, 48)
  const baseFontSize = clamp(Math.round(Math.min(width, height) * 0.12), 18, 140)
  // Estimate average character width relative to font-size. 0.55 is a reasonable average
  // for UI sans fonts; we'll shrink font-size if the estimated text width would overflow.
  const avgCharWidthFactor = 0.55

  // inset: fraction of width/height to reserve as padding (e.g., 0.06 -> 6%).
  const contentInset = clamp(Number(inset) || 0.06, 0, 0.3)
  const innerWidth = Math.round(width * (1 - 2 * contentInset))
  const innerHeight = Math.round(height * (1 - 2 * contentInset))

  let fontSize = baseFontSize
  if (label && label.length > 0) {
    const estWidth = Math.round(fontSize * avgCharWidthFactor * label.length)
    if (estWidth > innerWidth) {
      fontSize = Math.max(12, Math.floor(innerWidth / (avgCharWidthFactor * label.length)))
    }
  }

  const subFontSize = clamp(Math.round(fontSize * 0.28), 12, 32)
  const bigOpacity = 0.32

  // Position decorative circles using the inset so visuals don't hit the edges.
  const circle1Cx = Math.round(width * (contentInset + 0.65 * (1 - contentInset)))
  const circle1Cy = Math.round(height * (contentInset + 0.2 * (1 - contentInset)))
  const circle1R = Math.round(Math.min(innerWidth, innerHeight) * 0.32)

  const circle2Cx = Math.round(width * (contentInset + 0.2 * (1 - contentInset)))
  const circle2Cy = Math.round(height * (contentInset + 0.72 * (1 - contentInset)))
  const circle2R = Math.round(Math.min(innerWidth, innerHeight) * 0.4)

  // Watermark placement: bottom-right inside inset area with even padding.
  let watermarkGroup = ''
  if (watermarkContent) {
    const wmFrac = clamp(Number(watermarkScale) || 0.08, 0.02, 0.5)
    const wmOpacity = Math.max(0, Math.min(1, Number(watermarkOpacity) || 0.5))
    const fillAttr = watermarkColor ? `fill="${watermarkColor}"` : 'fill="currentColor"'

    // Default fallback viewBox if not provided
    const vb = watermarkViewBox || { minX: 0, minY: 0, width: 512, height: 512 }
    const s = (wmFrac * width) / (vb.width || 1)
    // Use a single uniform pixel padding for both right and bottom to keep distances equal.
    const padPx = Math.round(Math.min(width, height) * contentInset)
    const scaledW = Math.round(s * (vb.width || 0))
    const scaledH = Math.round(s * (vb.height || 0))
    const wmX = width - padPx - scaledW
    const wmY = height - padPx - scaledH

    // Normalize to viewBox origin, then scale, then place at bottom-right padding.
    watermarkGroup = `\n  <g transform="translate(${wmX}, ${wmY}) scale(${s}) translate(${-vb.minX || 0}, ${-vb.minY || 0})" opacity="${wmOpacity}" ${fillAttr}>\n    ${watermarkContent}\n  </g>`
  }
  const svgString = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="${width}" y2="${height}" gradientUnits="userSpaceOnUse">
      <stop stop-color="${gradStart}"/>
      <stop offset="1" stop-color="${gradEnd}"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" rx="${rx}" fill="url(#bg)"/>
  <g opacity="0.8">
    <circle cx="${circle1Cx}" cy="${circle1Cy}" r="${circle1R}" fill="${circle1Color}" fill-opacity="${circle1Opacity}"/>
    <circle cx="${circle2Cx}" cy="${circle2Cy}" r="${circle2R}" fill="${circle2Color}" fill-opacity="${circle2Opacity}"/>
  </g>${watermarkGroup}
  <text x="50%" y="${Math.round(height * 0.52)}" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" font-size="${fontSize}" font-weight="700" fill="#111827" opacity="${bigOpacity}">${label}</text>
  <text x="50%" y="${Math.round(height * 0.6)}" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" font-size="${subFontSize}" font-weight="600" fill="#111827" opacity="0.35">placeholder</text>
</svg>`

  return svgString
}

function printHelp() {
  console.log(`\
Generate placeholder SVGs from explicit dimensions (no scanning).

Usage:
  node scripts/generate-placeholders.mjs --dir <path> --size <WxH> [--size <WxH> ...]

Examples:
  node scripts/generate-placeholders.mjs --dir src/stories/assets --size 1440x900 --size 80x80
  node scripts/generate-placeholders.mjs --dir public/images --size 576x968 --force

Options:
  --dir <path>        Output directory (repeatable)
  --size <WxH>        Size like 1440x900 (repeatable)
  --prefix <string>   Filename prefix (default: placeholder)
  --label <string>    Label text to render in the SVG (default: WxH)
  --watermark <path>  Path to an SVG file to inline as a subtle watermark (optional)
  --watermark-opacity <n>  Watermark opacity (0-1, default: 0.5)
  --watermark-scale <n>    Watermark scale as fraction of width (default: 0.08)
  --watermark-color <hex>  Watermark fill color (e.g., #42E2B7). Defaults to currentColor
  --grad-start <hex>  Gradient start color (default: #E0F2FE)
  --grad-end <hex>    Gradient end color (default: #DBEAFE)
  --circle1-color <hex>     First circle fill (default: #3B82F6)
  --circle1-opacity <n>     First circle opacity 0-1 (default: 0.12)
  --circle2-color <hex>     Second circle fill (default: #6366F1)
  --circle2-opacity <n>     Second circle opacity 0-1 (default: 0.10)
  --out <path>        Output exact file path; infers size/label/colors from existing file when possible
  --force             Overwrite existing SVGs
  -h, --help          Show help
`)
}

function parseArgs(argv) {
  /** @type {{ dirs: string[]; sizes: string[]; prefix: string; label?: string; watermark?: string; watermarkOpacity?: string; watermarkScale?: string; watermarkColor?: string; gradStart?: string; gradEnd?: string; circle1Color?: string; circle1Opacity?: string; circle2Color?: string; circle2Opacity?: string; out?: string; force: boolean; help: boolean }} */
  const parsed = {
    dirs: [],
    sizes: [],
    prefix: 'placeholder',
    label: undefined,
    watermark: undefined,
    watermarkOpacity: undefined,
    watermarkScale: undefined,
    watermarkColor: undefined,
    gradStart: undefined,
    gradEnd: undefined,
    circle1Color: undefined,
    circle1Opacity: undefined,
    circle2Color: undefined,
    circle2Opacity: undefined,
    out: undefined,
    force: false,
    help: false,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (!arg) continue

    if (arg === '-h' || arg === '--help') {
      parsed.help = true
      continue
    }

    if (arg === '--force') {
      parsed.force = true
      continue
    }

    if (arg === '--dir') {
      const value = argv[i + 1]
      if (!value) throw new Error('Missing value for --dir')
      parsed.dirs.push(value)
      i += 1
      continue
    }

    if (arg === '--size') {
      const value = argv[i + 1]
      if (!value) throw new Error('Missing value for --size')
      parsed.sizes.push(value)
      i += 1
      continue
    }

    if (arg === '--prefix') {
      const value = argv[i + 1]
      if (!value) throw new Error('Missing value for --prefix')
      parsed.prefix = value
      i += 1
      continue
    }

    if (arg === '--label') {
      const value = argv[i + 1]
      if (!value) throw new Error('Missing value for --label')
      parsed.label = value
      i += 1
      continue
    }

    if (arg === '--watermark') {
      const value = argv[i + 1]
      if (!value) throw new Error('Missing value for --watermark')
      parsed.watermark = value
      i += 1
      continue
    }

    if (arg === '--watermark-opacity') {
      const value = argv[i + 1]
      if (!value) throw new Error('Missing value for --watermark-opacity')
      parsed.watermarkOpacity = value
      i += 1
      continue
    }

    if (arg === '--watermark-scale') {
      const value = argv[i + 1]
      if (!value) throw new Error('Missing value for --watermark-scale')
      parsed.watermarkScale = value
      i += 1
      continue
    }

    if (arg === '--watermark-color') {
      const value = argv[i + 1]
      if (!value) throw new Error('Missing value for --watermark-color')
      parsed.watermarkColor = value
      i += 1
      continue
    }

    if (arg === '--grad-start') {
      const value = argv[i + 1]
      if (!value) throw new Error('Missing value for --grad-start')
      parsed.gradStart = value
      i += 1
      continue
    }

    if (arg === '--grad-end') {
      const value = argv[i + 1]
      if (!value) throw new Error('Missing value for --grad-end')
      parsed.gradEnd = value
      i += 1
      continue
    }

    if (arg === '--circle1-color') {
      const value = argv[i + 1]
      if (!value) throw new Error('Missing value for --circle1-color')
      parsed.circle1Color = value
      i += 1
      continue
    }

    if (arg === '--circle1-opacity') {
      const value = argv[i + 1]
      if (!value) throw new Error('Missing value for --circle1-opacity')
      parsed.circle1Opacity = value
      i += 1
      continue
    }

    if (arg === '--circle2-color') {
      const value = argv[i + 1]
      if (!value) throw new Error('Missing value for --circle2-color')
      parsed.circle2Color = value
      i += 1
      continue
    }

    if (arg === '--circle2-opacity') {
      const value = argv[i + 1]
      if (!value) throw new Error('Missing value for --circle2-opacity')
      parsed.circle2Opacity = value
      i += 1
      continue
    }

    if (arg === '--out') {
      const value = argv[i + 1]
      if (!value) throw new Error('Missing value for --out')
      parsed.out = value
      i += 1
      continue
    }

    // Allow positional sizes too.
    if (SIZE_RE.test(arg)) {
      parsed.sizes.push(arg)
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  return parsed
}

function parseSize(size) {
  const match = size.match(SIZE_RE)
  if (!match) throw new Error(`Invalid size "${size}". Expected format: WxH (e.g. 1440x900).`)

  const width = Number(match[1])
  const height = Number(match[2])

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error(`Invalid size "${size}". Width/height must be positive numbers.`)
  }

  return { width, height }
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2))

  if (parsed.help) {
    printHelp()
    return
  }

  if (!parsed.out) {
    if (parsed.dirs.length === 0) {
      throw new Error('At least one --dir is required.')
    }
    if (parsed.sizes.length === 0) {
      throw new Error('At least one --size (or positional WxH) is required.')
    }
  }

  const dirs = parsed.dirs.map((dir) => path.resolve(process.cwd(), dir))
  const sizes = parsed.sizes.map(parseSize)
  const updates = []
  // If watermark path provided, read and strip outer <svg> wrapper so it can be inlined.
  let watermarkContent = undefined
  /** @type {{minX:number;minY:number;width:number;height:number}|undefined} */
  let watermarkViewBox = undefined
  if (parsed.watermark) {
    try {
      const raw = await fs.readFile(path.resolve(process.cwd(), parsed.watermark), 'utf8')
      // Extract viewBox if present
      const vbMatch = raw.match(/viewBox\s*=\s*"([\d\.]+)\s+([\d\.]+)\s+([\d\.]+)\s+([\d\.]+)"/i)
      if (vbMatch) {
        watermarkViewBox = {
          minX: Number(vbMatch[1]) || 0,
          minY: Number(vbMatch[2]) || 0,
          width: Number(vbMatch[3]) || 0,
          height: Number(vbMatch[4]) || 0,
        }
      }
      // remove outer <svg ...> and </svg>
      watermarkContent = raw
        .replace(/^[\s\S]*?<svg[^>]*>/i, '')
        .replace(/<\/svg>\s*$/i, '')
        .trim()
    } catch (err) {
      console.error(
        `Failed to read watermark SVG at ${parsed.watermark}: ${err instanceof Error ? err.message : String(err)}`,
      )
      watermarkContent = undefined
    }
  }

  if (parsed.out) {
    const outPath = path.resolve(process.cwd(), parsed.out)
    await fs.mkdir(path.dirname(outPath), { recursive: true })
    let inferred = {
      width: 0,
      height: 0,
      label: undefined,
      gradStart: undefined,
      gradEnd: undefined,
      c1: undefined,
      c1o: undefined,
      c2: undefined,
      c2o: undefined,
    }
    try {
      const existing = await fs.readFile(outPath, 'utf8')
      const wMatch = existing.match(/<svg[^>]*\bwidth=\"(\d+)\"[^>]*\bheight=\"(\d+)\"/i)
      if (wMatch) {
        inferred.width = Number(wMatch[1])
        inferred.height = Number(wMatch[2])
      } else {
        const vb = existing.match(/viewBox\s*=\s*\"([\d\.]+)\s+([\d\.]+)\s+([\d\.]+)\s+([\d\.]+)\"/i)
        if (vb) {
          inferred.width = Number(vb[3])
          inferred.height = Number(vb[4])
        }
      }
      const labelMatch = existing.match(/<text[^>]*>\s*([^<]+)\s*<\/text>/i)
      if (labelMatch) inferred.label = labelMatch[1]
      const bgStops = [...existing.matchAll(/<stop[^>]*stop-color=\"([^\"]+)\"[^>]*>/gi)]
      if (bgStops[0]) inferred.gradStart = bgStops[0][1]
      if (bgStops[1]) inferred.gradEnd = bgStops[1][1]
      const circles = [...existing.matchAll(/<circle[^>]*fill=\"([^\"]+)\"[^>]*fill-opacity=\"([\d\.]+)\"[^>]*>/gi)]
      if (circles[0]) {
        inferred.c1 = circles[0][1]
        inferred.c1o = circles[0][2]
      }
      if (circles[1]) {
        inferred.c2 = circles[1][1]
        inferred.c2o = circles[1][2]
      }
    } catch {}

    const size = sizes[0] || { width: inferred.width, height: inferred.height }
    if (!size.width || !size.height) throw new Error('Size could not be inferred; provide --size WxH')
    const label = parsed.label ?? inferred.label ?? `${size.width}×${size.height}`
    const svg = buildSvg({
      width: size.width,
      height: size.height,
      label,
      inset: undefined,
      watermarkContent,
      watermarkOpacity: parsed.watermarkOpacity,
      watermarkScale: parsed.watermarkScale,
      watermarkColor: parsed.watermarkColor,
      watermarkViewBox,
      gradStart: parsed.gradStart ?? inferred.gradStart,
      gradEnd: parsed.gradEnd ?? inferred.gradEnd,
      circle1Color: parsed.circle1Color ?? inferred.c1,
      circle1Opacity: parsed.circle1Opacity
        ? Number(parsed.circle1Opacity)
        : inferred.c1o
          ? Number(inferred.c1o)
          : undefined,
      circle2Color: parsed.circle2Color ?? inferred.c2,
      circle2Opacity: parsed.circle2Opacity
        ? Number(parsed.circle2Opacity)
        : inferred.c2o
          ? Number(inferred.c2o)
          : undefined,
    })
    await fs.writeFile(outPath, svg, 'utf8')
    updates.push(path.relative(process.cwd(), outPath))
  } else {
    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true })

      for (const { width, height } of sizes) {
        const label = parsed.label ? parsed.label : `${width}×${height}`
        const svg = buildSvg({
          width,
          height,
          label,
          inset: undefined,
          watermarkContent,
          watermarkOpacity: parsed.watermarkOpacity,
          watermarkScale: parsed.watermarkScale,
          watermarkColor: parsed.watermarkColor,
          watermarkViewBox,
          gradStart: parsed.gradStart,
          gradEnd: parsed.gradEnd,
          circle1Color: parsed.circle1Color,
          circle1Opacity: parsed.circle1Opacity ? Number(parsed.circle1Opacity) : undefined,
          circle2Color: parsed.circle2Color,
          circle2Opacity: parsed.circle2Opacity ? Number(parsed.circle2Opacity) : undefined,
        })
        const svgPath = path.join(dir, `${parsed.prefix}-${width}-${height}.svg`)

        if (!parsed.force) {
          try {
            await fs.access(svgPath)
            continue
          } catch {
            // Not present, proceed.
          }
        }

        await fs.writeFile(svgPath, svg, 'utf8')
        updates.push(path.relative(process.cwd(), svgPath))
      }
    }
  }

  console.log(`Generated ${updates.length} placeholder SVG(s).`)
  if (updates.length) {
    for (const file of updates) console.log(`- ${file}`)
  }
}

try {
  await main()
} catch (err) {
  const message = err instanceof Error ? err.message : String(err)
  console.error(message)
  printHelp()
  process.exitCode = 1
}
