import { execSync } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
import pg from 'pg'

const { Client } = pg

const DOCKER_COMPOSE = 'docker compose -p findmydoc-test -f docker-compose.test.yml'
const DEFAULT_CONN = 'postgresql://postgres:password@localhost:5433/findmydoc-test'

async function waitForDatabase(connectionString, timeoutMs = 60000, intervalMs = 750) {
  const start = Date.now()
  let consecutiveSuccesses = 0

  while (true) {
    const client = new Client({ connectionString })

    try {
      await client.connect()
      await client.query('SELECT 1')
      await client.end()
      consecutiveSuccesses += 1

      if (consecutiveSuccesses >= 3) {
        return
      }

      await sleep(intervalMs)
    } catch {
      consecutiveSuccesses = 0

      try {
        await client.end()
      } catch {}

      if (Date.now() - start > timeoutMs) {
        throw new Error(`Database not ready after ${timeoutMs}ms at ${connectionString}`)
      }

      await sleep(intervalMs)
    }
  }
}

async function runPayloadMigrateFresh({ attempts = 3, delayMs = 2000 } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      execSync("printf 'y\\n' | pnpm run payload migrate:fresh", {
        env: { ...process.env, NODE_ENV: 'test' },
        stdio: 'inherit',
      })
      return
    } catch (error) {
      if (attempt === attempts) {
        throw error
      }

      console.warn(`⚠️ migrate:fresh failed (attempt ${attempt}/${attempts}). Retrying in ${delayMs}ms...`)
      await sleep(delayMs)
    }
  }
}

function runDockerCompose(command) {
  if (command === 'down') {
    try {
      execSync(`${DOCKER_COMPOSE} down -v --remove-orphans`, { stdio: 'pipe' })
    } catch {}
    return
  }

  execSync(`${DOCKER_COMPOSE} up -d`, { stdio: 'inherit' })
}

export async function setupTestDatabase() {
  const connectionString = process.env.DATABASE_URI || DEFAULT_CONN

  console.log('🚀 Starting test database container...')
  runDockerCompose('down')
  runDockerCompose('up')
  console.log('⏳ Waiting for test database to be ready...')
  await waitForDatabase(connectionString)
  await sleep(500)
  console.log('📦 Running PayloadCMS migrations...')
  await runPayloadMigrateFresh()
  console.log('✅ Test database container started and migrated')
}

export async function teardownTestDatabase() {
  console.log('🧹 Stopping test database container...')
  runDockerCompose('down')
  console.log('✅ Test database container stopped, removed, and volumes cleaned')
}
