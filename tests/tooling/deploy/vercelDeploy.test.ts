import { afterEach, describe, expect, it } from 'vitest'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const repositoryRoot = path.resolve(import.meta.dirname, '../../..')
const temporaryDirectories = new Set<string>()

const expectArgument = (argumentsPassedToVercel: readonly string[], flag: string, value: string) => {
  expect(
    argumentsPassedToVercel.some(
      (argument, index) => argument === flag && argumentsPassedToVercel[index + 1] === value,
    ),
  ).toBe(true)
}

const runDeployment = () => {
  const temporaryDirectory = mkdtempSync(path.join(os.tmpdir(), 'website-vercel-deploy-'))
  temporaryDirectories.add(temporaryDirectory)
  const binaryDirectory = path.join(temporaryDirectory, 'bin')
  const commandLog = path.join(temporaryDirectory, 'vercel-commands.log')
  const githubOutput = path.join(temporaryDirectory, 'github-output')
  const fakePnpm = path.join(binaryDirectory, 'pnpm')
  mkdirSync(binaryDirectory)

  writeFileSync(
    fakePnpm,
    `#!/usr/bin/env bash
set -euo pipefail
{
  printf 'DEPLOYMENT_ENVIRONMENT=%s\\n' "$DEPLOYMENT_ENVIRONMENT"
  printf 'DEPLOYMENT_COMMIT_SHA=%s\\n' "$DEPLOYMENT_COMMIT_SHA"
  printf 'RELEASE_VERSION=%s\\n' "$RELEASE_VERSION"
  printf '%s\\n' "$@"
  printf '%s\\n' '--'
} >> "$VERCEL_STUB_LOG"
if [[ " $* " == *" deploy "* ]]; then
  printf '%s\\n' 'https://website-stub.vercel.app'
fi
`,
  )
  chmodSync(fakePnpm, 0o755)

  return {
    commandLog,
    result: spawnSync('bash', [path.join(repositoryRoot, '.github/scripts/deploy/vercel-deploy.sh'), 'production'], {
      cwd: temporaryDirectory,
      encoding: 'utf8',
      env: {
        ...process.env,
        DEPLOYMENT_COMMIT_SHA: 'a'.repeat(40),
        DEPLOYMENT_ENVIRONMENT: 'production',
        GITHUB_OUTPUT: githubOutput,
        PATH: `${binaryDirectory}:${process.env.PATH}`,
        RELEASE_VERSION: 'v1.2.3',
        VERCEL_DEPLOY_MAX_ATTEMPTS: '1',
        VERCEL_ORG_ID: 'org-test',
        VERCEL_PROJECT_ID: 'project-test',
        VERCEL_STUB_LOG: commandLog,
        VERCEL_TOKEN: 'test-token', // pragma: allowlist secret
      },
    }),
  }
}

afterEach(() => {
  for (const directory of temporaryDirectories) {
    rmSync(directory, { force: true, recursive: true })
  }
  temporaryDirectories.clear()
})

describe('website Vercel deployment contract', () => {
  it('passes production deployment metadata to Vercel build and runtime configuration', () => {
    const { commandLog, result } = runDeployment()

    expect(result.status).toBe(0)
    const command = readFileSync(commandLog, 'utf8').trim().split('\n--\n')
    const argumentsPassedToVercel = command[0]?.split('\n') ?? []

    expectArgument(argumentsPassedToVercel, '--build-env', 'DEPLOYMENT_ENVIRONMENT=production')
    expectArgument(argumentsPassedToVercel, '--build-env', `DEPLOYMENT_COMMIT_SHA=${'a'.repeat(40)}`)
    expectArgument(argumentsPassedToVercel, '--build-env', 'RELEASE_VERSION=v1.2.3')
    expectArgument(argumentsPassedToVercel, '--env', 'DEPLOYMENT_ENVIRONMENT=production')
    expectArgument(argumentsPassedToVercel, '--env', `DEPLOYMENT_COMMIT_SHA=${'a'.repeat(40)}`)
    expectArgument(argumentsPassedToVercel, '--env', 'RELEASE_VERSION=v1.2.3')
  })
})
