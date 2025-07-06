import { execSync } from 'child_process'

export async function setup() {
  try {
    console.log('🚀 Starting test database container...')

    // Stop and remove any existing containers and volumes
    try {
      execSync('docker compose -f docker-compose.test.yml down -v --remove-orphans', {
        stdio: 'pipe',
      })
    } catch {
      // No containers to stop, that's fine
    }

    // Start containers using docker-compose
    execSync('docker compose -f docker-compose.test.yml up -d', { stdio: 'inherit' })

    // Wait for database to be ready
    await new Promise((resolve) => setTimeout(resolve, 5000))

    // Run PayloadCMS migrations to create the database schema
    console.log('📦 Running PayloadCMS migrations...')
    execSync('pnpm payload migrate', {
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
    execSync('docker compose -f docker-compose.test.yml down -v --remove-orphans', {
      stdio: 'inherit',
    })
    console.log('✅ Test database container stopped, removed, and volumes cleaned')
  } catch (error) {
    console.warn('⚠️ Error stopping test database container:', error)
    // Don't throw - cleanup should continue even if container stop fails
  }
}
