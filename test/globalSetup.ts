import { execSync } from 'child_process'

export default async function setup() {
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
