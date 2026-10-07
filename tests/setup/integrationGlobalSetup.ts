import { loadLocalAndTestEnv } from '../../scripts/test-env.mjs'
import {
  assertIntegrationBaseline,
  setupTestDatabase,
  teardownTestDatabase,
} from '../../scripts/test-database-harness.mjs'

loadLocalAndTestEnv()

export async function setup() {
  try {
    if (process.env.INTEGRATION_BASELINE_COPY === '1') {
      await assertIntegrationBaseline()
      return
    }
    await setupTestDatabase({ templateKind: 'empty' })
  } catch (error) {
    console.error('❌ Failed to start test database:', error)
    throw error
  }
}

export async function teardown() {
  try {
    await teardownTestDatabase()
  } catch (error) {
    console.warn('⚠️ Error stopping test database container:', error)
  }
}
