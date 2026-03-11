import { execSync } from 'child_process'
import { Client } from 'pg'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(process.cwd(), '.env.test'), override: true })

const DOCKER_COMPOSE = 'docker compose -p findmydoc-test -f docker-compose.test.yml'
const DEFAULT_CONN = 'postgresql://postgres:password@localhost:5433/findmydoc-test'

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForDatabase(connectionString: string, timeoutMs = 60000, intervalMs = 750) {
  const start = Date.now()
  while (true) {
    const client = new Client({ connectionString })
    try {
      await client.connect()
      await client.query('SELECT 1')
      await client.end()
      return
    } catch {
      try {
        await client.end()
      } catch {}
      if (Date.now() - start > timeoutMs)
        throw new Error(`Database not ready after ${timeoutMs}ms at ${connectionString}`)
      await sleep(intervalMs)
    }
  }
}

function runDockerCompose(cmd: 'up' | 'down') {
  if (cmd === 'down') {
    try {
      execSync(`${DOCKER_COMPOSE} down -v --remove-orphans`, { stdio: 'pipe' })
    } catch {}
  } else {
    execSync(`${DOCKER_COMPOSE} up -d`, { stdio: 'inherit' })
  }
}

async function runMigrateFreshWithRetry(maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      execSync("printf 'y\\n' | pnpm run payload migrate:fresh", {
        env: { ...process.env, NODE_ENV: 'test' },
        stdio: 'inherit',
      })
      return
    } catch (error) {
      const isLastAttempt = attempt === maxAttempts
      if (isLastAttempt) throw error

      const backoffMs = 1000 * attempt
      console.warn(`⚠️ migrate:fresh failed on attempt ${attempt}/${maxAttempts}. Retrying in ${backoffMs}ms...`)
      await sleep(backoffMs)
    }
  }
}

export async function setup() {
  try {
    console.log('🚀 Starting test database container...')
    runDockerCompose('down')
    runDockerCompose('up')
    const connectionString = process.env.DATABASE_URI || DEFAULT_CONN
    console.log('⏳ Waiting for test database to be ready...')
    await waitForDatabase(connectionString)
    // Minimal grace period for Postgres to accept connections
    await sleep(300)
    console.log('📦 Running PayloadCMS migrations...')
    await runMigrateFreshWithRetry()
    console.log('✅ Test database container started and migrated')
  } catch (error) {
    console.error('❌ Failed to start test database:', error)
    throw error
  }
}

export async function teardown() {
  try {
    console.log('🧹 Stopping test database container...')
    runDockerCompose('down')
    console.log('✅ Test database container stopped, removed, and volumes cleaned')
  } catch (error) {
    console.warn('⚠️ Error stopping test database container:', error)
  }
}
