import fs from 'fs/promises'
import path from 'path'

import sharp from 'sharp'

export type OptimizeFormat = 'webp' | 'jpeg' | 'png'
export type OptimizePresetName = 'category' | 'hero'

export type OptimizePreset = {
  format: OptimizeFormat
  maxBytes: number
  minQuality: number
  quality: number
  width: number
}

export const OPTIMIZE_PRESETS: Record<OptimizePresetName, OptimizePreset> = {
  category: {
    width: 1600,
    format: 'webp',
    quality: 80,
    minQuality: 60,
    maxBytes: 700_000,
  },
  hero: {
    width: 2400,
    format: 'webp',
    quality: 82,
    minQuality: 62,
    maxBytes: 1_200_000,
  },
}

export type CliOptions = {
  dryRun: boolean
  format: OptimizeFormat
  inputPath: string
  maxBytes: number
  minQuality: number
  outputPath: string
  preset: OptimizePresetName
  quality: number
  recursive: boolean
  width: number
}

export type OptimizeRunResult = {
  inputPath: string
  outputPath: string
  outputSize: number
  outputWidth: number | null
  outputHeight: number | null
  quality: number
  skipped: boolean
}

const SUPPORTED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.tif', '.tiff'])

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max)

const toPosix = (value: string): string => value.split(path.sep).join(path.posix.sep)

const formatExtensionMap: Record<OptimizeFormat, string> = {
  webp: '.webp',
  jpeg: '.jpg',
  png: '.png',
}

export function formatBytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(3)} MB`
}

export function resolveCliOptions(argv: string[]): CliOptions {
  const cliValues = new Map<string, string>()
  const flags = new Set<string>()

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--') {
      continue
    }

    if (typeof arg !== 'string' || !arg.startsWith('--')) {
      continue
    }

    if (arg === '--dry-run' || arg === '--recursive') {
      flags.add(arg)
      continue
    }

    const nextValue = argv[index + 1]
    if (!nextValue || nextValue.startsWith('--')) {
      throw new Error(`Missing value for ${arg}`)
    }

    cliValues.set(arg, nextValue)
    index += 1
  }

  const presetName = (cliValues.get('--preset') ?? 'category') as OptimizePresetName
  const preset = OPTIMIZE_PRESETS[presetName]
  if (!preset) {
    throw new Error(`Unsupported preset "${presetName}". Expected one of: ${Object.keys(OPTIMIZE_PRESETS).join(', ')}`)
  }

  const inputPath = cliValues.get('--input')
  if (!inputPath) {
    throw new Error('Missing required --input path')
  }

  const outputPath = cliValues.get('--output')
  if (!outputPath) {
    throw new Error('Missing required --output path')
  }

  const width = clamp(Number.parseInt(cliValues.get('--width') ?? `${preset.width}`, 10), 320, 6000)
  const quality = clamp(Number.parseInt(cliValues.get('--quality') ?? `${preset.quality}`, 10), 1, 100)
  const minQuality = clamp(Number.parseInt(cliValues.get('--min-quality') ?? `${preset.minQuality}`, 10), 1, quality)
  const maxBytes = Math.max(Number.parseInt(cliValues.get('--max-bytes') ?? `${preset.maxBytes}`, 10), 1)
  const format = (cliValues.get('--format') ?? preset.format) as OptimizeFormat

  if (!(format in formatExtensionMap)) {
    throw new Error(`Unsupported format "${format}". Expected one of: ${Object.keys(formatExtensionMap).join(', ')}`)
  }

  return {
    inputPath,
    outputPath,
    preset: presetName,
    width,
    quality,
    minQuality,
    maxBytes,
    format,
    dryRun: flags.has('--dry-run'),
    recursive: flags.has('--recursive'),
  }
}

export function getOutputPathForFile(
  inputFile: string,
  inputRoot: string,
  outputRoot: string,
  format: OptimizeFormat,
): string {
  const relativePath = path.relative(inputRoot, inputFile)
  const parsed = path.parse(relativePath)
  return path.join(outputRoot, parsed.dir, `${parsed.name}${formatExtensionMap[format]}`)
}

export async function collectInputFiles(inputPath: string, recursive: boolean): Promise<string[]> {
  const stats = await fs.stat(inputPath)

  if (stats.isFile()) {
    return SUPPORTED_EXTENSIONS.has(path.extname(inputPath).toLowerCase()) ? [inputPath] : []
  }

  const entries = await fs.readdir(inputPath, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(inputPath, entry.name)
      if (entry.isDirectory()) {
        return recursive ? collectInputFiles(entryPath, recursive) : []
      }

      return SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase()) ? [entryPath] : []
    }),
  )

  return files.flat().sort((left, right) => left.localeCompare(right))
}

function buildWidthCandidates(width: number): number[] {
  const candidates = new Set<number>([width])
  let current = width

  while (current > 960) {
    current = Math.max(960, Math.round(current * 0.9))
    candidates.add(current)
    if (current === 960) break
  }

  return [...candidates].sort((left, right) => right - left)
}

function buildQualityCandidates(quality: number, minQuality: number): number[] {
  const candidates = new Set<number>([quality])
  let current = quality

  while (current > minQuality) {
    current = Math.max(minQuality, current - 4)
    candidates.add(current)
    if (current === minQuality) break
  }

  return [...candidates].sort((left, right) => right - left)
}

async function renderVariant(
  inputPath: string,
  format: OptimizeFormat,
  width: number,
  quality: number,
): Promise<{ buffer: Buffer; height: number | null; size: number; width: number | null }> {
  let pipeline = sharp(inputPath)
    .rotate()
    .resize({
      width,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .withMetadata({})

  switch (format) {
    case 'webp':
      pipeline = pipeline.webp({ quality, effort: 6 })
      break
    case 'jpeg':
      pipeline = pipeline.jpeg({ quality, mozjpeg: true, progressive: true })
      break
    case 'png':
      pipeline = pipeline.png({ compressionLevel: 9, palette: true, quality })
      break
  }

  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true })

  return {
    buffer: data,
    size: info.size,
    width: info.width ?? null,
    height: info.height ?? null,
  }
}

export async function optimizeSingleImage(
  inputPath: string,
  outputPath: string,
  options: CliOptions,
): Promise<OptimizeRunResult> {
  const widthCandidates = buildWidthCandidates(options.width)
  const qualityCandidates = buildQualityCandidates(options.quality, options.minQuality)

  let bestAttempt:
    | {
        buffer: Buffer
        height: number | null
        quality: number
        size: number
        width: number | null
      }
    | undefined

  for (const width of widthCandidates) {
    for (const quality of qualityCandidates) {
      const attempt = await renderVariant(inputPath, options.format, width, quality)

      if (!bestAttempt || attempt.size < bestAttempt.size) {
        bestAttempt = { ...attempt, quality }
      }

      if (attempt.size <= options.maxBytes) {
        bestAttempt = { ...attempt, quality }
        break
      }
    }

    if (bestAttempt && bestAttempt.size <= options.maxBytes) {
      break
    }
  }

  if (!bestAttempt) {
    throw new Error(`Unable to optimize image ${inputPath}`)
  }

  if (!options.dryRun) {
    await fs.mkdir(path.dirname(outputPath), { recursive: true })
    await fs.writeFile(outputPath, bestAttempt.buffer)
  }

  return {
    inputPath,
    outputPath,
    outputSize: bestAttempt.size,
    outputWidth: bestAttempt.width,
    outputHeight: bestAttempt.height,
    quality: bestAttempt.quality,
    skipped: false,
  }
}

export function createUsageText(): string {
  return [
    'Usage:',
    '  pnpm images:optimize -- --input <path> --output <path> [options]',
    '',
    'Options:',
    '  --preset <category|hero>   Default optimization profile (default: category)',
    '  --input <path>             Source image file or directory',
    '  --output <path>            Target file or directory',
    '  --width <number>           Max width in px (default from preset)',
    '  --quality <number>         Starting quality 1-100 (default from preset)',
    '  --min-quality <number>     Lowest allowed quality during size reduction',
    '  --max-bytes <number>       Byte budget per output file (default from preset)',
    '  --format <webp|jpeg|png>   Output format (default from preset)',
    '  --recursive                Traverse subdirectories when input is a directory',
    '  --dry-run                  Print planned output without writing files',
    '',
    'Examples:',
    '  pnpm images:optimize -- --input src/endpoints/seed/assets/baseline/medical-specialties --output tmp/medical-specialties --preset category',
    '  pnpm images:optimize -- --input hero.jpg --output tmp/hero.webp --preset hero --max-bytes 1200000',
  ].join('\n')
}

export async function runOptimizeImagesCli(rawArgv: string[]): Promise<void> {
  const options = resolveCliOptions(rawArgv)
  const files = await collectInputFiles(options.inputPath, options.recursive)

  if (files.length === 0) {
    throw new Error(`No supported image files found under ${options.inputPath}`)
  }

  const inputStats = await fs.stat(options.inputPath)
  const outputStats = await fs.stat(options.outputPath).catch(() => null)

  if (inputStats.isDirectory() && outputStats?.isFile()) {
    throw new Error('When --input points to a directory, --output must also be a directory path')
  }

  if (inputStats.isFile() && outputStats?.isDirectory()) {
    throw new Error('When --input points to a file, --output must be a file path')
  }

  const inputRoot = inputStats.isDirectory() ? options.inputPath : path.dirname(options.inputPath)
  const outputRoot = inputStats.isDirectory() ? options.outputPath : path.dirname(options.outputPath)

  console.log(
    [
      `preset=${options.preset}`,
      `format=${options.format}`,
      `width=${options.width}`,
      `quality=${options.quality}`,
      `minQuality=${options.minQuality}`,
      `maxBytes=${options.maxBytes}`,
      `dryRun=${options.dryRun}`,
      `recursive=${options.recursive}`,
    ].join(' '),
  )

  for (const inputFile of files) {
    const targetPath = inputStats.isDirectory()
      ? getOutputPathForFile(inputFile, inputRoot, outputRoot, options.format)
      : options.outputPath

    const originalSize = (await fs.stat(inputFile)).size
    const result = await optimizeSingleImage(inputFile, targetPath, options)

    const relativeInput = toPosix(path.relative(process.cwd(), inputFile))
    const relativeOutput = toPosix(path.relative(process.cwd(), targetPath))
    const reduction = ((1 - result.outputSize / originalSize) * 100).toFixed(1)

    console.log(
      `${relativeInput} -> ${relativeOutput} | ${formatBytes(originalSize)} -> ${formatBytes(result.outputSize)} | ` +
        `${result.outputWidth ?? '?'}x${result.outputHeight ?? '?'} | q=${result.quality} | reduction=${reduction}%`,
    )
  }
}
