import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import { optimizeSingleImage, resolveCliOptions } from '../../../scripts/optimize-images-lib'

describe('optimize-images-lib', () => {
  it('keeps source-preparation quality fixed unless degradation is explicit', () => {
    const options = resolveCliOptions([
      '--input',
      'input.png',
      '--output',
      'output.webp',
      '--preset',
      'teamPortrait',
      '--quality',
      '90',
      '--min-quality',
      '84',
    ])

    expect(options).toMatchObject({
      allowDegrade: false,
      preset: 'teamPortrait',
      quality: 90,
      minQuality: 84,
      minLongEdge: 1200,
    })
  })

  it('requires explicit allow-degrade when the prepared source exceeds the byte budget', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'optimize-images-'))
    const inputPath = path.join(tempDir, 'input.png')
    const outputPath = path.join(tempDir, 'output.webp')

    await sharp({
      create: {
        width: 512,
        height: 512,
        channels: 3,
        background: '#1f7a8c',
      },
    })
      .png()
      .toFile(inputPath)

    const options = resolveCliOptions([
      '--input',
      inputPath,
      '--output',
      outputPath,
      '--preset',
      'category',
      '--max-bytes',
      '1',
    ])

    await expect(optimizeSingleImage(inputPath, outputPath, options)).rejects.toThrow('pass --allow-degrade explicitly')
  })

  it('reports low-source warnings in dry-run output data', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'optimize-images-'))
    const inputPath = path.join(tempDir, 'input.webp')
    const outputPath = path.join(tempDir, 'output.webp')

    await sharp({
      create: {
        width: 320,
        height: 320,
        channels: 3,
        background: '#f7f7f7',
      },
    })
      .webp({ quality: 30 })
      .toFile(inputPath)

    const result = await optimizeSingleImage(
      inputPath,
      outputPath,
      resolveCliOptions(['--input', inputPath, '--output', outputPath, '--preset', 'landingProcess', '--dry-run']),
    )

    expect(result.warnings).toContain('input-long-edge-below-1400px')
    expect(result.warnings.some((warning) => warning.startsWith('low-source-bpp-'))).toBe(true)
  })
})
