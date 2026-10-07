import { realpathSync, statSync } from 'node:fs'
import path from 'node:path'
import { validateInput } from './common.mjs'

const LANES = ['admin', 'public']
const result = (mode, lanes, reason) => ({ mode, files: [], lanes, reasons: [reason], shadowFiles: [] })

const existingConfinedSpec = (root, spec) => {
  try {
    const canonicalRoot = realpathSync(root)
    const canonicalSpec = realpathSync(path.resolve(canonicalRoot, spec))
    const relative = path.relative(canonicalRoot, canonicalSpec)
    return relative.split(path.sep).join('/') === spec && statSync(canonicalSpec).isFile()
  } catch {
    return false
  }
}

export function selectE2e(input, { root = process.cwd() } = {}) {
  const validation = validateInput(input)
  if (!validation.valid) return result('full', [...LANES], validation.reason)

  const selected = new Set()
  for (const change of validation.changes) {
    if (change.status !== 'M' || change.previousPath !== undefined)
      return result('full', [...LANES], 'non-modification-change')
    if (change.path.endsWith('.md')) continue

    const admin = /^tests\/e2e\/admin\/(?:[^/]+\/)*[^/]+\.(?:admin-smoke|admin-login|admin-regression)\.spec\.ts$/.test(
      change.path,
    )
    const publicSpec = /^tests\/e2e\/public\/(?:[^/]+\/)*[^/]+\.public-smoke\.spec\.ts$/.test(change.path)
    if ((admin || publicSpec) && !existingConfinedSpec(root, change.path))
      return result('full', [...LANES], 'missing-or-unconfined-spec')
    if (admin) selected.add('admin')
    else if (publicSpec) selected.add('public')
    else return result('full', [...LANES], 'shared-or-unknown-input')
  }

  if (selected.size === 0) return result('skip', [], 'modified-documentation-only')
  if (selected.size === 2) return result('full', [...LANES], 'both-lanes-affected')
  return result(
    'selected',
    LANES.filter((lane) => selected.has(lane)),
    'modified-lane-specs-only',
  )
}

export function evaluateE2eOutcomes(selection, outcomes) {
  const lanes = selection?.lanes
  const validSelection =
    Array.isArray(lanes) &&
    new Set(lanes).size === lanes.length &&
    lanes.every((lane) => LANES.includes(lane)) &&
    ((selection.mode === 'full' && lanes.length === 2) ||
      (selection.mode === 'selected' && lanes.length === 1) ||
      (selection.mode === 'skip' && lanes.length === 0))
  if (!validSelection) return { valid: false, reasons: ['invalid-e2e-selection'] }

  const reasons = []
  for (const lane of LANES) {
    const required = lanes.includes(lane)
    const outcome = outcomes?.[lane]
    if (required && outcome !== 'success') reasons.push(`${lane}-required-but-not-successful`)
    if (!required && outcome !== 'skipped') reasons.push(`${lane}-must-be-intentionally-skipped`)
  }
  return { valid: reasons.length === 0, reasons }
}

export function assessE2eTarget(evidence) {
  if (evidence?.immutable !== true) return { blocked: true, reason: 'immutable-target-evidence-required' }
  const commits = [evidence.deploymentCommit, evidence.sourceCommit, evidence.databaseCommit]
  if (!commits.every((commit) => typeof commit === 'string' && /^[a-f0-9]{40}$/i.test(commit)))
    return { blocked: true, reason: 'valid-full-commit-identities-required' }
  if (new Set(commits.map((commit) => commit.toLowerCase())).size !== 1)
    return { blocked: true, reason: 'target-source-database-commit-mismatch' }
  return { blocked: false, reason: 'immutable-target-matches-source-and-database' }
}
