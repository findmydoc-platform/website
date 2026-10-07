import { defineConfig } from 'vitest/config'
import baseConfig from './vitest.config'

const base = baseConfig
const subset = process.env.CI_SELECTION_SUBSET === 'true'

// A subset report is diagnostic coverage, never a replacement for the full-suite gate.
export default defineConfig({
  ...base,
  test: {
    ...base.test,
    coverage: {
      ...base.test?.coverage,
      reportsDirectory: process.env.CI_SELECTION_COVERAGE ?? 'tmp/ci-selection-poc/coverage',
      thresholds: subset ? undefined : base.test?.coverage?.thresholds,
    },
  },
})
