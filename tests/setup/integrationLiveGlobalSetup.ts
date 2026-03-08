import { execSync } from 'child_process'
import { ensureStorageBucket } from '../../src/utilities/storage/s3'
import { assertS3RuntimeConfig } from '../../src/utilities/storage/runtime'
import { setup as setupDb, teardown as teardownDb } from './integrationGlobalSetup'
import { applyStorageLiveEnvDefaults } from './storageLiveEnv'

const DOCKER_COMPOSE = 'docker compose -p findmydoc-storage-live -f docker-compose.storage-test.yml'
const MINIO_HEALTH_URL = 'http://127.0.0.1:9000/minio/health/live'

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isEnabled(): boolean {
  return process.env.STORAGE_LIVE_TESTS === 'true'
}

function runDockerCompose(cmd: 'up' | 'down') {
  if (cmd === 'down') {
    try {
      execSync(`${DOCKER_COMPOSE} down -v --remove-orphans`, { stdio: 'pipe' })
    } catch {}
    return
  }

  execSync(`${DOCKER_COMPOSE} up -d`, { stdio: 'inherit' })
}

async function waitForMinio(timeoutMs = 60000, intervalMs = 750) {
  const start = Date.now()

  while (true) {
    try {
      const response = await fetch(MINIO_HEALTH_URL)
      if (response.ok) return
    } catch {}

    if (Date.now() - start > timeoutMs) {
      throw new Error(`MinIO not ready after ${timeoutMs}ms at ${MINIO_HEALTH_URL}`)
    }

    await sleep(intervalMs)
  }
}

export async function setup() {
  if (!isEnabled()) return

  applyStorageLiveEnvDefaults()

  try {
    await setupDb()
    runDockerCompose('down')
    runDockerCompose('up')
    await waitForMinio()
    await ensureStorageBucket(assertS3RuntimeConfig())
  } catch (error) {
    runDockerCompose('down')
    await teardownDb()
    throw error
  }
}

export async function teardown() {
  if (!isEnabled()) return

  runDockerCompose('down')
  await teardownDb()
}
