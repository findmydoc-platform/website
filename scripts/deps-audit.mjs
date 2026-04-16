import { spawnSync } from 'node:child_process'

const args = ['audit', '--audit-level=high']
const result = spawnSync('pnpm', args, {
  cwd: process.cwd(),
  encoding: 'utf8',
  env: process.env,
})

if (result.stdout) process.stdout.write(result.stdout)
if (result.stderr) process.stderr.write(result.stderr)

if (result.status === 0) {
  process.exit(0)
}

const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
const isRetiredEndpointError =
  output.includes('ERR_PNPM_AUDIT_BAD_RESPONSE') &&
  output.includes('responded with 410') &&
  output.includes('/-/npm/v1/security/audits')

if (isRetiredEndpointError) {
  console.warn(
    'Warning: Skipping pnpm audit failure because npm retired the legacy /security/audits endpoint used by pnpm 10.x.',
  )
  console.warn('Warning: Keep Deep Quality Lane green until the repo migrates to a pnpm version using advisories/bulk.')
  process.exit(0)
}

if (result.error) {
  console.error(result.error.message)
}

process.exit(result.status ?? 1)
