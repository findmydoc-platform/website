import { execSync } from 'child_process'
require('ts-node/register') // Required for TS files

export default async () => {
  console.log('\nStarting PostgreSQL container...')
  execSync('docker compose -f docker-compose.test.yml up -d', {
    stdio: 'inherit',
  })

  console.log('Applying migrations to test database...')
  execSync('pnpm payload migrate', {
    env: { ...process.env, NODE_ENV: 'test' },
    stdio: 'inherit',
  })

  console.log('Test database is ready.')
}
