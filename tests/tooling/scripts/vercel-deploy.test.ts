import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

const repositoryRoot = path.resolve(import.meta.dirname, '../../..')
const temporaryDirectories = new Set<string>()

const runDeployHelper = (
  target: 'preview' | 'production',
  metadataOverrides: Record<string, string | undefined> = {},
  pulledPreviewEnvironment = '',
) => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'vercel-deploy-test-'))
  temporaryDirectories.add(temporaryDirectory)

  const vercelDirectory = path.join(temporaryDirectory, '.vercel')
  fs.mkdirSync(vercelDirectory)
  fs.writeFileSync(path.join(vercelDirectory, '.env.preview.local'), pulledPreviewEnvironment)

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

  const { RELEASE_VERSION: _releaseVersion, ...environmentWithoutReleaseVersion } = process.env
  const result = spawnSync('bash', [path.join(repositoryRoot, '.github/scripts/deploy/vercel-deploy.sh'), target], {
    cwd: temporaryDirectory,
    encoding: 'utf8',
    env: {
      ...environmentWithoutReleaseVersion,
      COMMAND_LOG: commandLog,
      DATABASE_DIRECT_URI: 'postgresql://direct.example.test:5432/postgres',
      DATABASE_URI: 'postgresql://runtime.example.test:6543/postgres',
      DEPLOYMENT_COMMIT_SHA: 'a'.repeat(40),
      DEPLOYMENT_ENVIRONMENT: target,
      EXPECTED_VERCEL_PROJECT_ID: 'project_test',
      GITHUB_OUTPUT: githubOutput,
      PATH: `${temporaryDirectory}:${process.env.PATH ?? ''}`,
      PAYLOAD_SECRET: 'payload-test-secret', // pragma: allowlist secret
      ...(target === 'production' ? { RELEASE_VERSION: 'v1.2.3' } : {}),
      ...metadataOverrides,
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
  it('prebuilds Preview in GitHub and only permits the central production caller', () => {
    const previewWorkflow = fs.readFileSync(path.join(repositoryRoot, '.github/workflows/deploy-preview.yml'), 'utf8')
    const platformReleaseWorkflow = fs.readFileSync(
      path.join(repositoryRoot, '.github/workflows/platform-release-deploy.yml'),
      'utf8',
    )

    expect(previewWorkflow).toContain('DATABASE_DIRECT_URI: ${{ secrets.DATABASE_DIRECT_URI }}')
    expect(previewWorkflow).toContain('CLINIC_DASHBOARD_URL: https://clinics.preview.findmydoc.eu')
    expect(previewWorkflow).toContain('DEPLOYMENT_ENVIRONMENT: preview')
    expect(previewWorkflow).toContain('git rev-parse HEAD')
    expect(platformReleaseWorkflow).toContain('reusable-deploy-website.yml@d9864de3b6d453464f4b84960cd1d6b40b97bb71')
    expect(fs.existsSync(path.join(repositoryRoot, '.github/workflows/deploy-production.yml'))).toBe(false)

    const preview = runDeployHelper('preview')
    expect(preview.result.status).toBe(0)
    expect(preview.commands).toHaveLength(2)
    expect(preview.commands[0]).toBe('dlx vercel@canary build --target preview --yes')
    expect(preview.commands[1]).toContain('dlx vercel@canary deploy --prebuilt --target preview --yes')
    expect(preview.commands[1]).toContain('--build-env DEPLOYMENT_ENVIRONMENT=preview')
    expect(preview.commands[1]).toContain(`--build-env DEPLOYMENT_COMMIT_SHA=${'a'.repeat(40)}`)
    expect(preview.commands[1]).toContain('--env DEPLOYMENT_ENVIRONMENT=preview')
    expect(preview.commands[1]).not.toContain('DATABASE_DIRECT_URI')
    expect(preview.commands[1]).not.toContain('DATABASE_URI')
    expect(preview.commands[1]).not.toContain('PAYLOAD_SECRET')

    const production = runDeployHelper('production')
    expect(production.result.status).toBe(0)
    expect(production.commands).toHaveLength(1)
    expect(production.commands[0]).toContain('dlx vercel@canary deploy --prod')
    expect(production.commands[0]).toContain('--build-env DEPLOYMENT_ENVIRONMENT=production')
    expect(production.commands[0]).toContain('--env RELEASE_VERSION=v1.2.3')
    expect(production.commands[0]).toContain('--build-env PAYLOAD_SECRET=payload-test-secret')
    expect(production.commands[0]).toContain('--build-env DATABASE_URI=postgresql://runtime.example.test:6543/postgres')
  })

  it('stops a contradictory contract before invoking Vercel', () => {
    const preview = runDeployHelper('preview', { RELEASE_VERSION: 'v1.2.3' })

    expect(preview.result.status).toBe(1)
    expect(preview.commands).toEqual([])
    expect(preview.result.stderr).toContain('RELEASE_VERSION must be unset for Preview deployments.')
  })

  it('rejects a durable Preview release version pulled from Vercel before build or upload', () => {
    const preview = runDeployHelper('preview', {}, 'RELEASE_VERSION="v9.9.9"\n')

    expect(preview.result.status).toBe(1)
    expect(preview.commands).toEqual([])
    expect(preview.result.stderr).toContain('Pulled Preview environment must not define RELEASE_VERSION.')
    expect(preview.result.stderr).not.toContain('v9.9.9')
  })

  it.each([
    {
      name: 'missing production release version',
      overrides: { RELEASE_VERSION: undefined },
      target: 'production' as const,
    },
    {
      name: 'invalid production release version',
      overrides: { RELEASE_VERSION: '1.2.3' },
      target: 'production' as const,
    },
    {
      name: 'invalid commit SHA',
      overrides: { DEPLOYMENT_COMMIT_SHA: 'short-sha' },
      target: 'preview' as const,
    },
    {
      name: 'environment and target contradiction',
      overrides: { DEPLOYMENT_ENVIRONMENT: 'production' },
      target: 'preview' as const,
    },
  ])('rejects $name before invoking Vercel', ({ overrides, target }) => {
    const deployment = runDeployHelper(target, overrides)

    expect(deployment.result.status).toBe(1)
    expect(deployment.commands).toEqual([])
  })
})
