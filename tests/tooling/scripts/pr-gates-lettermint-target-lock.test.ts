import { describe, expect, it } from 'vitest'
import {
  preservesActivatedTargets,
  targetLocksPreserved,
} from '../../../.github/scripts/pr-gates-lettermint-target-lock.cjs'

const preview = {
  environment: 'preview',
  teamId: 'preview-team',
  projectId: 'preview-project',
  routeId: 'preview-route',
}
const production = {
  environment: 'production',
  teamId: 'production-team',
  projectId: 'production-project',
  routeId: 'production-route',
}

describe('Lettermint target lock PR gate', () => {
  it('allows Preview to be registered before Production', () => {
    expect(preservesActivatedTargets({ targets: [] }, { targets: [preview] })).toBe(true)
  })

  it('allows Production to be appended without changing Preview', () => {
    expect(preservesActivatedTargets({ targets: [preview] }, { targets: [preview, production] })).toBe(true)
  })

  it('allows initial registration of two separate targets', () => {
    expect(preservesActivatedTargets({ targets: [] }, { targets: [preview, production] })).toBe(true)
  })

  it('rejects duplicate environments', () => {
    expect(
      preservesActivatedTargets(
        { targets: [] },
        {
          targets: [preview, { ...preview, teamId: 'other-team', projectId: 'other-project', routeId: 'other-route' }],
        },
      ),
    ).toBe(false)
  })

  it.each(['teamId', 'projectId', 'routeId'] as const)('rejects shared %s during initial registration', (field) => {
    expect(
      preservesActivatedTargets({ targets: [] }, { targets: [preview, { ...production, [field]: preview[field] }] }),
    ).toBe(false)
  })

  it('allows credential rotation without target changes', () => {
    expect(preservesActivatedTargets({ targets: [preview, production] }, { targets: [preview, production] })).toBe(true)
  })

  it.each(['teamId', 'projectId', 'routeId'] as const)('rejects a changed %s after registration', (field) => {
    expect(
      preservesActivatedTargets(
        { targets: [preview, production] },
        { targets: [{ ...preview, [field]: 'new-value' }, production] },
      ),
    ).toBe(false)
  })

  it.each(['teamId', 'projectId', 'routeId'] as const)(
    'rejects a changed Preview %s while Production is appended',
    (field) => {
      expect(
        preservesActivatedTargets(
          { targets: [preview] },
          { targets: [{ ...preview, [field]: 'new-value' }, production] },
        ),
      ).toBe(false)
    },
  )

  it('rejects removal of a previously registered target', () => {
    expect(preservesActivatedTargets({ targets: [preview, production] }, { targets: [] })).toBe(false)
  })

  it.each([
    { name: 'empty', currentTargets: [] },
    { name: 'Preview-only', currentTargets: [preview] },
  ])(
    'reads the base and pull request lock files as commit-pinned API data for a $name registry',
    async ({ currentTargets }) => {
      const calls: Array<{ owner: string; repo: string; path: string; ref: string }> = []
      const github = {
        rest: {
          repos: {
            getContent: async (request: { owner: string; repo: string; path: string; ref: string }) => {
              calls.push(request)
              const value = request.ref === 'base-sha' ? { targets: [] } : { targets: currentTargets }
              return { data: { encoding: 'base64', content: Buffer.from(JSON.stringify(value)).toString('base64') } }
            },
          },
        },
      }
      const context = {
        repo: { owner: 'trusted', repo: 'website' },
        payload: {
          pull_request: {
            base: { sha: 'base-sha' },
            head: { sha: 'head-sha', repo: { owner: { login: 'contributor' }, name: 'website-fork' } },
          },
        },
      }

      expect(await targetLocksPreserved({ github, context })).toBe(true)
      expect(calls).toEqual([
        {
          owner: 'trusted',
          repo: 'website',
          path: 'src/features/transactionalEmail/lettermintTargetLocks.json',
          ref: 'base-sha',
        },
        {
          owner: 'contributor',
          repo: 'website-fork',
          path: 'src/features/transactionalEmail/lettermintTargetLocks.json',
          ref: 'head-sha',
        },
      ])
    },
  )
})
