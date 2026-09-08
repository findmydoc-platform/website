const COMMIT_SHA_PATTERN = /^[0-9a-f]{40}$/
const RELEASE_VERSION_PATTERN = /^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/

type DeploymentEnvironment = 'production' | 'preview'

export type PostHogDeploymentMetadata = {
  deployment_commit_sha: string
  deployment_environment: DeploymentEnvironment
  release_version?: string
}

export type PostHogDeploymentMetadataResolution =
  { kind: 'invalid'; reason: string } | { kind: 'local' } | { kind: 'remote'; metadata: PostHogDeploymentMetadata }

type DeploymentMetadataEnvironment = {
  DEPLOYMENT_COMMIT_SHA?: string
  DEPLOYMENT_ENVIRONMENT?: string
  NODE_ENV?: string
  RELEASE_VERSION?: string
}

const isProductionProcess = (environment: DeploymentMetadataEnvironment): boolean =>
  environment.NODE_ENV === 'production'

export const resolvePostHogDeploymentMetadata = (
  environment: DeploymentMetadataEnvironment = process.env,
): PostHogDeploymentMetadataResolution => {
  if (!isProductionProcess(environment)) {
    return { kind: 'local' }
  }

  const deploymentEnvironment = environment.DEPLOYMENT_ENVIRONMENT

  if (deploymentEnvironment === undefined) {
    return { kind: 'invalid', reason: 'DEPLOYMENT_ENVIRONMENT is required in a production process' }
  }

  if (deploymentEnvironment !== 'production' && deploymentEnvironment !== 'preview') {
    return { kind: 'invalid', reason: 'DEPLOYMENT_ENVIRONMENT must be production or preview' }
  }

  const commitSha = environment.DEPLOYMENT_COMMIT_SHA
  if (!commitSha || !COMMIT_SHA_PATTERN.test(commitSha)) {
    return { kind: 'invalid', reason: 'DEPLOYMENT_COMMIT_SHA must be a full lowercase SHA' }
  }

  if (deploymentEnvironment === 'preview') {
    if (environment.RELEASE_VERSION !== undefined) {
      return { kind: 'invalid', reason: 'RELEASE_VERSION must be unset for preview deployments' }
    }

    return {
      kind: 'remote',
      metadata: {
        deployment_commit_sha: commitSha,
        deployment_environment: 'preview',
      },
    }
  }

  const releaseVersion = environment.RELEASE_VERSION
  if (!releaseVersion || !RELEASE_VERSION_PATTERN.test(releaseVersion)) {
    return { kind: 'invalid', reason: 'RELEASE_VERSION must be a vX.Y.Z version for production deployments' }
  }

  return {
    kind: 'remote',
    metadata: {
      deployment_commit_sha: commitSha,
      deployment_environment: 'production',
      release_version: releaseVersion,
    },
  }
}
