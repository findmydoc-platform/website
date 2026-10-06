import { describe, expect, it } from 'vitest'
import {
  experimentPlan,
  runExperiment,
  validateFailureProbe,
  matchesDispatch,
} from '../../../scripts/ci-build-experiment.mjs'

const jobs = (variant: string, failure: string) =>
  [
    'Classify',
    'Static Checks',
    'Unit Tests',
    'Storybook Tests',
    'Build late',
    'Build early',
    'Integration Tests',
    'Combined Coverage',
    'Build',
  ].map((name) => ({
    name: `Build diagnostics / ${name}`,
    conclusion:
      name === 'Build'
        ? 'failure'
        : failure === 'classification'
          ? name === 'Classify'
            ? 'failure'
            : name === 'Combined Coverage'
              ? 'success'
              : 'skipped'
          : name === 'Static Checks'
            ? 'failure'
            : name === 'Build late' ||
                name === 'Integration Tests' ||
                (name === 'Build early' && variant === 'baseline')
              ? 'skipped'
              : 'success',
  }))

describe('Separated build experiment execution', () => {
  it('contains three separate pairs per filter class and three scheduling pairs', () => {
    const plan = experimentPlan()
    for (const scenario of ['docs', 'tests', 'metadata', 'runtime'])
      expect(
        plan.filter(
          (item: { experiment: string; scenario: string; failure: string }) =>
            item.experiment === 'filter' && item.scenario === scenario && item.failure === 'none',
        ),
      ).toHaveLength(6)
    expect(
      plan.filter(
        (item: { experiment: string; failure: string }) => item.experiment === 'schedule' && item.failure === 'none',
      ),
    ).toHaveLength(6)
    expect(
      new Set(
        plan.map((item: { experiment: string; scenario: string; variant: string; round: number; failure: string }) =>
          JSON.stringify(item),
        ),
      ).size,
    ).toBe(plan.length)
  })
  it('reverses comparison order and keeps failure probes outside samples', () => {
    expect(
      experimentPlan()
        .filter(
          (item: { experiment: string; scenario: string; round: number; failure: string }) =>
            item.experiment === 'schedule' && item.round === 2 && item.failure === 'none',
        )
        .map((item: { variant: string }) => item.variant),
    ).toEqual(['candidate', 'baseline'])
    expect(experimentPlan().filter((item: { failure: string }) => item.failure !== 'none')).toHaveLength(4)
  })
  it('rejects receipts from another dispatch even when the source commit matches', () => {
    const item = { experiment: 'filter', scenario: 'tests', variant: 'candidate', round: 1, failure: 'none' }
    const measurement = { commit: 'a'.repeat(40), correctness: { scope: { ...item, commit: 'a'.repeat(40) } } }
    expect(matchesDispatch(item, measurement)).toBe(true)
    expect(matchesDispatch({ ...item, round: 2 }, measurement)).toBe(false)
    expect(matchesDispatch({ ...item, variant: 'baseline' }, measurement)).toBe(false)
  })
  it('defaults to dry-run instead of dispatching GitHub work', async () => {
    expect(await runExperiment({ commit: 'a'.repeat(40), output: 'unused', stage: 'smoke' })).toMatchObject({
      dryRun: true,
      plan: [{ variant: 'baseline' }, { variant: 'candidate' }],
    })
    await expect(runExperiment({ commit: 'main', output: 'unused' })).rejects.toThrow('Full frozen commit')
  })
  it.each(['baseline', 'candidate'])('requires visible classification failure and blocked work for %s', (variant) => {
    const measurement = {
      variant,
      failure: 'classification',
      run: { conclusion: 'failure' },
      jobs: jobs(variant, 'classification'),
    }
    expect(validateFailureProbe(measurement)).toBe(true)
    expect(() =>
      validateFailureProbe({
        ...measurement,
        jobs: measurement.jobs.map((job) =>
          job.name.endsWith('Build early') ? { ...job, conclusion: 'success' } : job,
        ),
      }),
    ).toThrow()
  })
  it.each(['baseline', 'candidate'])('accounts for build work after failed static checks for %s', (variant) => {
    const measurement = { variant, failure: 'static', run: { conclusion: 'failure' }, jobs: jobs(variant, 'static') }
    expect(validateFailureProbe(measurement)).toBe(true)
    expect(() => validateFailureProbe({ ...measurement, run: { conclusion: 'success' } })).toThrow()
  })
})
