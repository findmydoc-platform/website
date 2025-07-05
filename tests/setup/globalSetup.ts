import { execSync } from 'child_process'

export async function setup() {
  try {
    console.log('🚀 Starting test database container...')

    // Stop any existing container
    try {
      execSync('docker stop findmydoc-test-db', { stdio: 'pipe' })
      execSync('docker rm findmydoc-test-db', { stdio: 'pipe' })
    } catch {
      // Container doesn't exist, that's fine
    }

    // Start fresh container
    execSync(
      `docker run -d --name findmydoc-test-db \
      -e POSTGRES_DB=findmydoc_test \
      -e POSTGRES_USER=test \
      -e POSTGRES_PASSWORD=test \
      -p 5433:5432 \
      postgres:15`,
      { stdio: 'inherit' },
    )

    // Wait for database to be ready
    await new Promise((resolve) => setTimeout(resolve, 3000))

    console.log('✅ Test database container started')
  } catch (error) {
    console.error('❌ Failed to start test database:', error)
    throw error
  }
}

export async function teardown() {
  try {
    console.log('🧹 Stopping test database container...')
    execSync('docker stop findmydoc-test-db', { stdio: 'inherit' })
    execSync('docker rm findmydoc-test-db', { stdio: 'inherit' })
    console.log('✅ Test database container stopped and removed')
  } catch (error) {
    console.warn('⚠️ Error stopping test database container:', error)
    // Don't throw - cleanup should continue even if container stop fails
  }
}
