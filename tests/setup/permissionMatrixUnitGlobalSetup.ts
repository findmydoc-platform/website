import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

export default function permissionMatrixUnitGlobalSetup(): void {
  mkdirSync(resolve('tmp'), { recursive: true })

  const res = spawnSync('pnpm', ['-s', 'dlx', 'tsx', 'scripts/permission-matrix/derive-json.ts', 'json'], {
    stdio: 'inherit',
  })

  if (res.status !== 0) {
    throw new Error(`Failed to derive permission matrix JSON for unit tests (exit=${res.status})`)
  }
}
