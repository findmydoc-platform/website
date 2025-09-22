import { execSync } from 'child_process'
import { Client } from 'pg'
import path from 'path'
import dotenv from 'dotenv'

// Ensure test env vars (e.g., DATABASE_URI) are loaded before we try to connect
dotenv.config({ path: path.resolve(process.cwd(), '.env.test') })

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForDatabase(
  connectionString: string,
  timeoutMs = Number(process.env.TEST_DB_TIMEOUT_MS ?? 60_000),
  intervalMs = 750,
) {
  const start = Date.now()

  // Try to connect in a loop until timeout
  /* eslint-disable no-constant-condition */
  while (true) {
    const client = new Client({ connectionString })
    try {
      await client.connect()
      await client.query('SELECT 1')
      await client.end()
      return
    } catch (err: any) {
      // If database doesn't exist yet, try default postgres DB
      const msg = String(err?.message ?? err)
      if (/does not exist/i.test(msg) || /database .* not exist/i.test(msg)) {
        try {
          const url = new URL(connectionString)
          url.pathname = '/postgres'
          const fallback = new Client({ connectionString: url.toString() })
          await fallback.connect()
          await fallback.query('SELECT 1')
          await fallback.end()
          // Connected to server; original DB may be created by migrations shortly
        } catch {
          // ignore, we'll retry
        }
      }
      try {
        await client.end()
      } catch {
        // ignore
      }
      if (Date.now() - start > timeoutMs) {
        throw new Error(`Database not ready after ${timeoutMs}ms at ${connectionString}`)
      }
      await sleep(intervalMs)
    }
  }
}

export async function setup() {
  try {
    console.log('🚀 Starting test database container...')

    // Stop and remove any existing containers and volumes
    try {
      execSync('docker compose -p findmydoc-test -f docker-compose.test.yml down -v --remove-orphans', {
        stdio: 'pipe',
      })
    } catch {
      // No containers to stop, that's fine
    }

    // Start containers using docker-compose
    execSync('docker compose -p findmydoc-test -f docker-compose.test.yml up -d', { stdio: 'inherit' })

    // Wait for database to be ready (lean, cross-platform)
    const defaultConn = 'postgresql://postgres:password@localhost:5433/findmydoc-test'
    const connectionString = process.env.DATABASE_URI || defaultConn
    console.log('⏳ Waiting for test database to be ready...')
    await waitForDatabase(connectionString)

    // Run PayloadCMS migrations to create the database schema
    // Short grace period to allow Postgres to fully accept connections under load
    await sleep(500)
    console.log('📦 Running PayloadCMS migrations...')
    execSync('pnpm run migrate', {
      env: { ...process.env, NODE_ENV: 'test' },
      stdio: 'inherit',
    })

    console.log('✅ Test database container started and migrated')
  } catch (error) {
    console.error('❌ Failed to start test database:', error)
    throw error
  }
}

export async function teardown() {
  try {
    console.log('🧹 Stopping test database container...')
    execSync('docker compose -p findmydoc-test -f docker-compose.test.yml down -v --remove-orphans', {
      stdio: 'inherit',
    })
    console.log('✅ Test database container stopped, removed, and volumes cleaned')
  } catch (error) {
    console.warn('⚠️ Error stopping test database container:', error)
    // Don't throw - cleanup should continue even if container stop fails
  }
}
