import { execSync } from 'child_process'
import 'ts-node/register'

export default async () => {
  console.log('\nStopping PostgreSQL container...')
  execSync('docker compose -f docker-compose.test.yml down', { stdio: 'inherit' })
}
