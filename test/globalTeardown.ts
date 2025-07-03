import { execSync } from 'child_process'

export default async function teardown() {
  console.log('\nStopping PostgreSQL container...')
  execSync('docker compose -f docker-compose.test.yml down', { stdio: 'inherit' })
}
