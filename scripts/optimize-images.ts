/**
 * Script: optimize-images
 * Usage:
 *   pnpm images:optimize -- --input <path> --output <path> [options]
 *
 * Purpose:
 *   Normalize source images for web delivery before they are copied into
 *   storage-backed collections or seed asset folders.
 *
 * Typical category-image example:
 *   pnpm images:optimize -- --input src/endpoints/seed/assets/baseline/medical-specialties \
 *     --output tmp/medical-specialties --preset category
 *
 * Typical single hero example:
 *   pnpm images:optimize -- --input hero-source.jpg --output tmp/hero.webp \
 *     --preset hero --max-bytes 1200000
 *
 * Notes:
 *   - Input can be a single file or a directory.
 *   - Output can be a single file or a directory.
 *   - Default preset `category` writes web-optimized output for taxonomy/category imagery.
 *   - Use `--dry-run` to inspect the planned result without writing files.
 */
import { createUsageText, runOptimizeImagesCli } from './optimize-images-lib'

async function main() {
  if (process.argv.includes('--help')) {
    console.log(createUsageText())
    return
  }

  await runOptimizeImagesCli(process.argv.slice(2))
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error'
  console.error(message)
  console.error('')
  console.error(createUsageText())
  process.exit(1)
})
