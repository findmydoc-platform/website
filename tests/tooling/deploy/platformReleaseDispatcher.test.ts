import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const runGuard = (actor: string, triggeringActor: string) =>
  spawnSync(
    'bash',
    [path.resolve(import.meta.dirname, '../../../.github/scripts/deploy/require-platform-release-dispatcher.sh')],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        GITHUB_ACTOR: actor,
        GITHUB_TRIGGERING_ACTOR: triggeringActor,
      },
    },
  )

describe('platform release dispatcher guard', () => {
  it('allows only the platform release GitHub App to start production delivery', () => {
    expect(runGuard('findmydoc-platform-release[bot]', 'findmydoc-platform-release[bot]').status).toBe(0)
  })

  it.each([
    ['human dispatch', 'SebastianSchuetze', 'SebastianSchuetze'],
    ['manual rerun of a bot run', 'findmydoc-platform-release[bot]', 'SebastianSchuetze'],
  ])('rejects %s', (_name, actor, triggeringActor) => {
    expect(runGuard(actor, triggeringActor).status).toBe(1)
  })
})
