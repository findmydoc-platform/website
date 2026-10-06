import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createVitest } from 'vitest/node'
import {
  groups,
  scenarios,
  inventoryGroups,
  runtimeGraph,
  selectGroups,
  validateMeasurement,
} from './ci-domain-poc.mjs'
import { loadLocalAndTestEnv } from './test-env.mjs'
import { setupTestDatabase, teardownTestDatabase } from './test-database-harness.mjs'

const options = Object.fromEntries(
  process.argv
    .slice(2)
    .reduce(
      (result, arg, index, all) => (arg.startsWith('--') ? [...result, [arg.slice(2), all[index + 1]]] : result),
      [],
    ),
)
const experiment = options.experiment ?? 'config',
  variant = options.variant ?? 'baseline',
  group = options.group ?? 'location',
  scenario = options.scenario ?? 'country',
  round = Number(options.round ?? 1)
if (
  !['config', 'selection'].includes(experiment) ||
  !['baseline', 'candidate'].includes(variant) ||
  !groups[group] ||
  !scenarios[scenario] ||
  ![1, 2].includes(round)
)
  throw new Error('Invalid domain POC options.')
if (!options.output) throw new Error('--output is required.')
const output = path.resolve(options.output)
fs.mkdirSync(output, { recursive: true })
if (fs.existsSync(path.join(output, 'receipt.json'))) throw new Error('Evidence exists; use a new attempt directory.')
loadLocalAndTestEnv()
Object.assign(process.env, {
  NODE_ENV: 'test',
  DEPLOYMENT_ENV: 'test',
  CI: 'true',
  CI_DB_COPY: '1',
  CI_DB_COPY_VERIFY_ISOLATION: '1',
})
const started = performance.now()
const receipt = {
  version: 1,
  experiment,
  variant,
  group,
  scenario,
  round,
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  node: process.version,
  pnpm: execFileSync('pnpm', ['--version'], { encoding: 'utf8' }).trim(),
  status: 'failed',
  cleanup: 'failed',
  groups: [],
}
const save = () => fs.writeFileSync(path.join(output, 'receipt.json'), JSON.stringify(receipt, null, 2))
const timed = async (name, work) => {
  const start = performance.now()
  try {
    return await work()
  } finally {
    receipt[name] = performance.now() - start
  }
}
try {
  const inventory = inventoryGroups()
  fs.writeFileSync(path.join(output, 'inventory.json'), JSON.stringify(inventory.groups, null, 2))
  const staticFiles = []
  let classificationFailed = false
  receipt.selection = await timed('selectionMs', async () => {
    if (experiment === 'selection')
      for (const name of Object.keys(groups)) {
        Object.assign(process.env, { DOMAIN_POC_GROUP: name, DOMAIN_POC_CONFIG: 'candidate' })
        let ctx
        try {
          ctx = await createVitest('test', {
            config: 'vitest.integration-domain-poc.config.ts',
            related: scenarios[scenario],
            watch: false,
            run: true,
          })
          staticFiles.push(
            ...(await ctx.getRelevantTestSpecifications()).map((spec) =>
              path.relative(process.cwd(), spec.moduleId).split(path.sep).join('/'),
            ),
          )
        } catch {
          classificationFailed = true
        } finally {
          await ctx?.close()
        }
      }
    const manifests = Object.fromEntries(
      Object.entries(inventory.groups).map(([name, manifest]) => [
        name,
        {
          ...manifest,
          dependencies: [
            ...new Set([
              ...manifest.dependencies,
              ...runtimeGraph(
                groups[name].files.map((file) => `tests/integration-domain-poc/${name}/${file}`),
                process.cwd(),
                true,
              ).files,
            ]),
          ],
        },
      ]),
    )
    return experiment === 'config'
      ? { groups: [group], reasons: ['fixed-workload'], fallback: false }
      : selectGroups(scenarios[scenario], manifests, staticFiles, classificationFailed)
  })
  const selected = experiment === 'selection' && variant === 'baseline' ? Object.keys(groups) : receipt.selection.groups
  if (!selected.length) throw new Error('Synthetic benchmark unexpectedly selected no cases.')
  await timed('databasePreparationMs', () => setupTestDatabase({ templateKind: 'baseline' }))
  for (const name of selected) {
    const directory = path.join(output, name)
    fs.mkdirSync(directory, { recursive: true })
    Object.assign(process.env, {
      DOMAIN_POC_GROUP: name,
      DOMAIN_POC_CONFIG: experiment === 'selection' ? 'candidate' : variant,
      DOMAIN_POC_REPORT: path.join(directory, 'tests.json'),
      DOMAIN_POC_PHASES: path.join(directory, 'phases.jsonl'),
      DOMAIN_POC_COVERAGE: path.join(directory, 'coverage'),
      CI_DB_COPY_REPORT: path.join(directory, 'copies.jsonl'),
    })
    const start = performance.now()
    execFileSync(
      process.execPath,
      ['node_modules/vitest/vitest.mjs', 'run', '--config', 'vitest.integration-domain-poc.config.ts', '--coverage'],
      { stdio: 'inherit', env: process.env },
    )
    receipt.groups.push({
      name,
      durationMs: performance.now() - start,
      report: JSON.parse(fs.readFileSync(process.env.DOMAIN_POC_REPORT, 'utf8')),
    })
  }
  receipt.status = 'passed'
} catch (error) {
  receipt.error =
    error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/[^\s]+/g, '[database]') : 'Measurement failed'
  process.exitCode = 1
} finally {
  try {
    await timed('cleanupMs', () => teardownTestDatabase())
    receipt.cleanup = 'passed'
  } catch {
    receipt.cleanup = 'failed'
    process.exitCode = 1
  }
  receipt.durationMs = performance.now() - started
  try {
    validateMeasurement(receipt)
  } catch (error) {
    receipt.status = 'failed'
    receipt.validationError = error.message
    process.exitCode = 1
  }
  save()
}
