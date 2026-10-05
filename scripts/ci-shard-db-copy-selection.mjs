import counts from './ci-shard-db-copy-selection.json' with { type: 'json' }
import { hookFiles } from './ci-shard-hook-validation.mjs'

const mixed = [
  ...hookFiles(),
  'tests/integration/countries.lifecycle.test.ts',
  'tests/integration/medicalSpecialties.upsert.integration.test.ts',
  'tests/integration/categories.lifecycle.test.ts',
  'tests/integration/platformContentMedia.lifecycle.test.ts',
  'tests/integration/seedReset.storage.test.ts',
  'tests/integration/seedUploadRecovery.storage.test.ts',
  'tests/integration/posts.lifecycle.test.ts',
  'tests/integration/access/clinics-access.test.ts',
  'tests/integration/authActions.lifecycle.test.ts',
]

export const extendedCopyStages = ['db-copy-mixed', 'db-copy-suite']
export function copyFiles(stage, round = 1) {
  if (![1, 2, 3].includes(round)) throw new Error('Invalid database copy round.')
  if (!extendedCopyStages.includes(stage)) return hookFiles(round)
  const files = stage === 'db-copy-suite' ? Object.keys(counts) : stage === 'db-copy-mixed' ? mixed : hookFiles()
  return round === 2 ? [...files].reverse() : round === 3 ? [...files.slice(1), files[0]] : [...files]
}

export function validateCopySelection(report, stage, round) {
  const files = copyFiles(stage, round)
  if (JSON.stringify(report.modules.map((item) => item.filename)) !== JSON.stringify(files))
    throw new Error('Database copy file selection or order differs from the manifest.')
  if (report.modules.some((item) => item.tests.length !== counts[item.filename]))
    throw new Error('Database copy case counts differ from the verified manifest.')
  return files
}
