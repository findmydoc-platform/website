import path from 'path'

import { describe, expect, it } from 'vitest'

import {
  createUsageText,
  getOutputPathForFile,
  OPTIMIZE_PRESETS,
  resolveCliOptions,
} from '../../../scripts/optimize-images-lib'

describe('optimize-images-lib', () => {
  it('resolves category preset defaults', () => {
    const options = resolveCliOptions([
      '--input',
      'src/endpoints/seed/assets/baseline/medical-specialties',
      '--output',
      'tmp/medical-specialties',
    ])

    expect(options.preset).toBe('category')
    expect(options.format).toBe(OPTIMIZE_PRESETS.category.format)
    expect(options.width).toBe(OPTIMIZE_PRESETS.category.width)
    expect(options.quality).toBe(OPTIMIZE_PRESETS.category.quality)
    expect(options.maxBytes).toBe(OPTIMIZE_PRESETS.category.maxBytes)
    expect(options.dryRun).toBe(false)
  })

  it('allows explicit overrides', () => {
    const options = resolveCliOptions([
      '--preset',
      'hero',
      '--input',
      'hero.jpg',
      '--output',
      'tmp/hero.webp',
      '--width',
      '1800',
      '--quality',
      '76',
      '--min-quality',
      '64',
      '--max-bytes',
      '900000',
      '--format',
      'jpeg',
      '--dry-run',
    ])

    expect(options.preset).toBe('hero')
    expect(options.width).toBe(1800)
    expect(options.quality).toBe(76)
    expect(options.minQuality).toBe(64)
    expect(options.maxBytes).toBe(900000)
    expect(options.format).toBe('jpeg')
    expect(options.dryRun).toBe(true)
  })

  it('ignores the pnpm argument separator', () => {
    const options = resolveCliOptions(['--', '--input', 'hero.jpg', '--output', 'tmp/hero.webp', '--dry-run'])

    expect(options.inputPath).toBe('hero.jpg')
    expect(options.outputPath).toBe('tmp/hero.webp')
    expect(options.dryRun).toBe(true)
  })

  it('builds output paths with format conversion', () => {
    const result = getOutputPathForFile(
      path.join('src', 'endpoints', 'seed', 'assets', 'baseline', 'medical-specialties', 'dental-root.jpg'),
      path.join('src', 'endpoints', 'seed', 'assets'),
      'tmp/assets-optimized',
      'webp',
    )

    expect(result).toBe(path.join('tmp/assets-optimized', 'baseline', 'medical-specialties', 'dental-root.webp'))
  })

  it('prints usage text with examples', () => {
    const usage = createUsageText()

    expect(usage).toContain('pnpm images:optimize')
    expect(usage).toContain('--preset <category|hero>')
    expect(usage).toContain('--dry-run')
  })
})
