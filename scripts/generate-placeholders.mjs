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

function buildSvg({ width, height, label }) {
  const rx = clamp(Math.round(Math.min(width, height) * 0.06), 12, 48)
  const fontSize = clamp(Math.round(Math.min(width, height) * 0.12), 18, 140)
  const subFontSize = clamp(Math.round(fontSize * 0.28), 12, 32)
  const bigOpacity = 0.32

  // Keep gradients light + neutral so it works across the site.
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="${width}" y2="${height}" gradientUnits="userSpaceOnUse">
      <stop stop-color="#E0F2FE"/>
      <stop offset="1" stop-color="#DBEAFE"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" rx="${rx}" fill="url(#bg)"/>
  <g opacity="0.8">
    <circle cx="${Math.round(width * 0.73)}" cy="${Math.round(height * 0.28)}" r="${Math.round(Math.min(width, height) * 0.32)}" fill="#3B82F6" fill-opacity="0.12"/>
    <circle cx="${Math.round(width * 0.28)}" cy="${Math.round(height * 0.78)}" r="${Math.round(Math.min(width, height) * 0.4)}" fill="#6366F1" fill-opacity="0.10"/>
  </g>
  <text x="50%" y="52%" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" font-size="${fontSize}" font-weight="700" fill="#111827" opacity="${bigOpacity}">${label}</text>
  <text x="50%" y="60%" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" font-size="${subFontSize}" font-weight="600" fill="#111827" opacity="0.35">placeholder</text>
</svg>`
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
  --force             Overwrite existing SVGs
  -h, --help          Show help
`)
}

function parseArgs(argv) {
  /** @type {{ dirs: string[]; sizes: string[]; prefix: string; force: boolean; help: boolean }} */
  const parsed = { dirs: [], sizes: [], prefix: 'placeholder', force: false, help: false }

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

  if (parsed.dirs.length === 0) {
    throw new Error('At least one --dir is required.')
  }

  if (parsed.sizes.length === 0) {
    throw new Error('At least one --size (or positional WxH) is required.')
  }

  const dirs = parsed.dirs.map((dir) => path.resolve(process.cwd(), dir))
  const sizes = parsed.sizes.map(parseSize)
  const updates = []

  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true })

    for (const { width, height } of sizes) {
      const label = `${width}×${height}`
      const svg = buildSvg({ width, height, label })
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
