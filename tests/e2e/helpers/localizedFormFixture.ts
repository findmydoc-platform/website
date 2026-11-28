import { execFileSync } from 'node:child_process'

export function runLocalizedFormFixture(command: 'create' | 'cleanup', prefix: string, mode: 'full' | 'holding') {
  execFileSync(
    process.execPath,
    ['--import', 'tsx', 'scripts/public-e2e-localized-form-fixture.ts', command, prefix, mode],
    {
      env: { ...process.env, NODE_ENV: 'test' },
      stdio: 'inherit',
      timeout: 60_000,
    },
  )
}
