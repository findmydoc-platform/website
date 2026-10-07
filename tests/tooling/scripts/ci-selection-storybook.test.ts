import { describe, expect, it } from 'vitest'

import { selectStorybook } from '../../../scripts/ci-selection-poc/storybook.mjs'

const workerRoute = 'src/app/api/internal/transactional-email/worker/route.ts'
const workerModification = { status: 'M', path: workerRoute }

function expectDecision(input: unknown, mode: 'full' | 'skip') {
  const decision = selectStorybook(input)
  expect(decision).toEqual({
    mode,
    files: [],
    lanes: [],
    reasons: expect.any(Array),
    shadowFiles: [],
  })
  expect(decision.reasons.length).toBeGreaterThan(0)
  for (const reason of decision.reasons) expect(reason).toEqual(expect.any(String))
  return decision
}

describe('whole-job Storybook selection', () => {
  it('skips only a modification of the verified backend route without mutating the manifest', () => {
    const input = Object.freeze({ changes: Object.freeze([Object.freeze({ ...workerModification })]) })
    expectDecision(input, 'skip')
    expect(input.changes).toEqual([workerModification])
  })

  it.each([
    ['component', 'src/components/atoms/FallbackImage/index.tsx'],
    ['colocated story', 'src/components/atoms/FallbackImage/FallbackImage.stories.tsx'],
    ['central story', 'src/stories/organisms/FavoriteClinicsList.stories.tsx'],
    ['Storybook config', '.storybook/main.ts'],
    ['preview', '.storybook/preview.tsx'],
    ['browser setup', '.storybook/vitest.setup.js'],
    ['global styles', 'src/app/(frontend)/globals.css'],
    ['image config', 'src/imageConfig.js'],
    ['dependency lockfile', 'pnpm-lock.yaml'],
    ['Vitest config', 'vitest.config.ts'],
    ['shared provider', 'src/providers/Theme/index.tsx'],
    ['worker dependency', 'src/features/transactionalEmail/hostedScheduler.ts'],
    ['neighboring endpoint', 'src/app/api/internal/transactional-email/worker/health.ts'],
    ['unknown path', 'new-domain/unknown.ts'],
    ['documentation', 'docs/example.md'],
  ])('keeps the full job for %s, alone or mixed with the backend exception', (_label, path) => {
    const relevant = { status: 'M', path }
    expectDecision({ changes: [relevant] }, 'full')
    expectDecision({ changes: [workerModification, relevant] }, 'full')
    expectDecision({ changes: [relevant, workerModification] }, 'full')
  })

  it.each(['A', 'D', 'R', 'C', 'T'])('does not exempt status %s even at the allowlisted path', (status) => {
    const change = { status, path: workerRoute, previousPath: 'src/app/api/old-worker/route.ts' }
    expectDecision({ changes: [change] }, 'full')
    expectDecision({ changes: [workerModification, change] }, 'full')
  })

  it('does not exempt a modification carrying a previous path', () => {
    expectDecision({ changes: [{ ...workerModification, previousPath: workerRoute }] }, 'full')
  })

  it.each([
    undefined,
    null,
    {},
    { changes: [] },
    { changes: null },
    { changes: [null] },
    { changes: [{ status: 'unknown', path: workerRoute }] },
    { changes: [{ status: 'R', path: workerRoute }] },
    { changes: [workerModification], classificationFailed: true },
  ])('falls back to full for an untrusted or empty manifest %#', (input) => {
    expectDecision(input, 'full')
  })

  it.each([
    `/${workerRoute}`,
    `./${workerRoute}`,
    `src/../${workerRoute}`,
    workerRoute.replaceAll('/', '\\'),
    `${workerRoute}\0`,
    `${workerRoute}.bak`,
    workerRoute.replace('worker', 'Worker'),
  ])('does not exempt an unsafe or near-matching path %#', (path) => {
    expectDecision({ changes: [{ status: 'M', path }] }, 'full')
  })

  it('returns fresh output arrays so one decision cannot change subsequent results', () => {
    const first = selectStorybook({ changes: [workerModification] })
    const firstFiles = first.files as string[]
    firstFiles.push('unexpected')
    expect(first.files).toEqual(['unexpected'])
    first.reasons.length = 0
    const second = expectDecision({ changes: [workerModification] }, 'skip')
    expect(second.files).toEqual([])
  })
})
