import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

const repositoryRoot = path.resolve(import.meta.dirname, '../../..')
const temporaryDirectories = new Set<string>()

const runDeployHelper = (target: 'preview' | 'production') => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'vercel-deploy-test-'))
  temporaryDirectories.add(temporaryDirectory)

  const commandLog = path.join(temporaryDirectory, 'commands.log')
  const githubOutput = path.join(temporaryDirectory, 'github-output.txt')
  const pnpmPath = path.join(temporaryDirectory, 'pnpm')

  fs.writeFileSync(
    pnpmPath,
    `#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "\${COMMAND_LOG}"
if [[ "$*" == *" deploy "* ]]; then
  echo "https://findmydoc-preview-test.vercel.app"
fi
`,
    { mode: 0o755 },
  )

  const result = spawnSync('bash', [path.join(repositoryRoot, '.github/scripts/deploy/vercel-deploy.sh'), target], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      COMMAND_LOG: commandLog,
      DATABASE_DIRECT_URI: 'postgresql://direct.example.test:5432/postgres',
      DATABASE_URI: 'postgresql://runtime.example.test:6543/postgres',
      EXPECTED_VERCEL_PROJECT_ID: 'project_test',
      GITHUB_OUTPUT: githubOutput,
      PATH: `${temporaryDirectory}:${process.env.PATH ?? ''}`,
      PAYLOAD_SECRET: 'payload-test-secret', // pragma: allowlist secret
      VERCEL_DEPLOY_MAX_ATTEMPTS: '1',
      VERCEL_ORG_ID: 'team_test',
      VERCEL_PROJECT_ID: 'project_test',
      VERCEL_TOKEN: 'token-test',
    },
  })

  return {
    commands: fs.existsSync(commandLog) ? fs.readFileSync(commandLog, 'utf8').trim().split('\n').filter(Boolean) : [],
    result,
  }
}

afterEach(() => {
  for (const directory of temporaryDirectories) {
    fs.rmSync(directory, { force: true, recursive: true })
  }
  temporaryDirectories.clear()
})

describe('Vercel deployment boundary', () => {
  it('prebuilds Preview in GitHub without changing the Production deployment path', () => {
    const previewWorkflow = fs.readFileSync(path.join(repositoryRoot, '.github/workflows/deploy-preview.yml'), 'utf8')
    const productionWorkflow = fs.readFileSync(
      path.join(repositoryRoot, '.github/workflows/deploy-production.yml'),
      'utf8',
    )

    expect(previewWorkflow).toContain('DATABASE_DIRECT_URI: ${{ secrets.DATABASE_DIRECT_URI }}')
    expect(previewWorkflow).toContain('CLINIC_DASHBOARD_URL: https://clinics.preview.findmydoc.eu')
    expect(productionWorkflow).not.toContain('DATABASE_DIRECT_URI')

    const preview = runDeployHelper('preview')
    expect(preview.result.status).toBe(0)
    expect(preview.commands).toHaveLength(2)
    expect(preview.commands[0]).toBe('dlx vercel@canary build --target preview --yes')
    expect(preview.commands[1]).toContain('dlx vercel@canary deploy --prebuilt --target preview --yes')
    expect(preview.commands[1]).not.toContain('--build-env')
    expect(preview.commands[1]).not.toContain('DATABASE_DIRECT_URI')
    expect(preview.commands[1]).not.toContain('DATABASE_URI')
    expect(preview.commands[1]).not.toContain('PAYLOAD_SECRET')

    const production = runDeployHelper('production')
    expect(production.result.status).toBe(0)
    expect(production.commands).toHaveLength(1)
    expect(production.commands[0]).toContain('dlx vercel@canary deploy --prod')
    expect(production.commands[0]).toContain('--build-env PAYLOAD_SECRET=payload-test-secret')
    expect(production.commands[0]).toContain('--build-env DATABASE_URI=postgresql://runtime.example.test:6543/postgres')
  })
})
