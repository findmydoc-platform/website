import { loadLocalAndTestEnv } from '../../scripts/test-env.mjs'
import { restoreIntegrationBaseline } from '../../scripts/test-database-harness.mjs'

// The normal isolated fork imports its test module only after this restore finishes.
loadLocalAndTestEnv()
await restoreIntegrationBaseline()
