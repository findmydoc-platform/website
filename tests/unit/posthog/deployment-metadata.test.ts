import { describe, expect, it } from 'vitest'
import { resolvePostHogDeploymentMetadata } from '../../../src/posthog/deployment-metadata'

const commitSha = 'a'.repeat(40)

describe('resolvePostHogDeploymentMetadata', () => {
  it.each([
    {
      environment: {
        DEPLOYMENT_COMMIT_SHA: commitSha,
        DEPLOYMENT_ENVIRONMENT: 'production',
        NODE_ENV: 'production',
        RELEASE_VERSION: 'v1.2.3',
      },
      expected: {
        kind: 'remote',
        metadata: {
          deployment_commit_sha: commitSha,
          deployment_environment: 'production',
          release_version: 'v1.2.3',
        },
      },
      name: 'accepts a complete production contract',
    },
    {
      environment: {
        DEPLOYMENT_COMMIT_SHA: commitSha,
        DEPLOYMENT_ENVIRONMENT: 'preview',
        NODE_ENV: 'production',
      },
      expected: {
        kind: 'remote',
        metadata: {
          deployment_commit_sha: commitSha,
          deployment_environment: 'preview',
        },
      },
      name: 'accepts a complete preview contract without a release version',
    },
    {
      environment: { NODE_ENV: 'test' },
      expected: { kind: 'local' },
      name: 'keeps local and test execution local',
    },
    {
      environment: {
        DEPLOYMENT_COMMIT_SHA: commitSha,
        DEPLOYMENT_ENVIRONMENT: 'production',
        NODE_ENV: 'test',
        RELEASE_VERSION: 'v1.2.3',
      },
      expected: { kind: 'local' },
      name: 'keeps tests local even when a complete remote contract is present',
    },
    {
      environment: { NODE_ENV: 'production' },
      expected: { kind: 'invalid', reason: 'DEPLOYMENT_ENVIRONMENT is required in a production process' },
      name: 'rejects a missing production contract',
    },
    {
      environment: {
        DEPLOYMENT_COMMIT_SHA: commitSha,
        DEPLOYMENT_ENVIRONMENT: 'preview',
        NODE_ENV: 'production',
        RELEASE_VERSION: 'v1.2.3',
      },
      expected: { kind: 'invalid', reason: 'RELEASE_VERSION must be unset for preview deployments' },
      name: 'rejects a preview version',
    },
    {
      environment: {
        DEPLOYMENT_COMMIT_SHA: 'short-sha',
        DEPLOYMENT_ENVIRONMENT: 'production',
        NODE_ENV: 'production',
        RELEASE_VERSION: 'v1.2.3',
      },
      expected: { kind: 'invalid', reason: 'DEPLOYMENT_COMMIT_SHA must be a full lowercase SHA' },
      name: 'rejects a non-frozen commit SHA',
    },
  ])('$name', ({ environment, expected }) => {
    expect(resolvePostHogDeploymentMetadata(environment)).toEqual(expected)
  })
})
