import { defineConfig } from 'vitest/config'
import path from 'node:path'

const group = process.env.DOMAIN_POC_GROUP ?? 'location'
if (!['location', 'gallery'].includes(group)) throw new Error('Unknown domain POC group.')
const variant = process.env.DOMAIN_POC_CONFIG ?? 'candidate'
if (!['baseline', 'candidate'].includes(variant)) throw new Error('Unknown domain POC configuration.')
const configPath = path.resolve(
  variant === 'baseline' ? 'src/payload.config.ts' : `tests/integration-domain-poc/${group}/payload.config.ts`,
)
const include =
  group === 'location'
    ? ['src/collections/Countries.ts']
    : [
        'src/collections/ClinicGalleryEntries/**/*.ts',
        'src/collections/ClinicGalleryMedia/**/*.ts',
        'src/access/clinicGallery.ts',
      ]
export default defineConfig({
  resolve: { alias: { '@payload-config': configPath, '@/payload.config': configPath, '@': path.resolve('src') } },
  test: {
    name: 'integration-domain-poc',
    include: [`tests/integration-domain-poc/${group}/*.test.ts`],
    environment: 'node',
    pool: 'forks',
    fileParallelism: false,
    isolate: true,
    sequence: { concurrent: false },
    testTimeout: 30000,
    hookTimeout: 60000,
    setupFiles: [
      'tests/setup/silenceLogs.ts',
      'tests/setup/nextCacheMock.ts',
      'tests/setup/supabaseProvisionMock.ts',
      'tests/setup/integrationBaselineCopy.ts',
    ],
    reporters: ['default', './scripts/ci-domain-poc-reporter.mjs'],
    coverage: {
      provider: 'v8',
      include,
      exclude: ['src/payload-types.ts'],
      reportOnFailure: true,
      reporter: ['json', 'json-summary'],
      reportsDirectory: process.env.DOMAIN_POC_COVERAGE ?? `coverage/domain-poc/${group}`,
    },
  },
})
