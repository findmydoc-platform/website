import { execSync, spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
import { applyE2ERuntimeDefaults, loadLocalAndTestEnv } from './test-env.mjs'
import { setupTestDatabase, teardownTestDatabase } from './test-database-harness.mjs'

loadLocalAndTestEnv()

const { baseUrl, port } = applyE2ERuntimeDefaults(process.env)
const appEnv = {
  ...process.env,
  HOSTNAME: 'localhost',
  NEXT_PUBLIC_SERVER_URL: baseUrl,
  NODE_ENV: 'development',
  PORT: String(port),
}

let appProcess
let shuttingDown = false

const stopAppProcess = async () => {
  if (!appProcess || appProcess.exitCode !== null || appProcess.killed) {
    return
  }

  appProcess.kill('SIGTERM')

  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (appProcess.exitCode !== null) {
      return
    }
    await sleep(250)
  }

  appProcess.kill('SIGKILL')
}

const shutdown = async (exitCode = 0) => {
  if (shuttingDown) {
    return
  }

  shuttingDown = true

  try {
    await stopAppProcess()
  } finally {
    try {
      await teardownTestDatabase()
    } finally {
      process.exit(exitCode)
    }
  }
}

const seedBaseline = () => {
  console.log('🌱 Seeding baseline test data...')
  execSync('pnpm run seed:run -- --type baseline --runtime-env test', {
    env: { ...process.env, NODE_ENV: 'development' },
    stdio: 'inherit',
  })
  console.log('✅ Baseline test data seeded')
}

const startApp = () => {
  console.log(`🌐 Starting Next.js app for E2E at ${baseUrl}`)

  appProcess = spawn('pnpm', ['dev'], {
    env: appEnv,
    stdio: 'inherit',
  })

  appProcess.on('exit', (code) => {
    if (shuttingDown) {
      return
    }

    console.error(`❌ E2E app process exited unexpectedly with code ${code ?? 0}`)
    void shutdown(code ?? 1)
  })
}

process.on('SIGINT', () => {
  void shutdown(130)
})

process.on('SIGTERM', () => {
  void shutdown(0)
})

process.on('uncaughtException', (error) => {
  console.error(error)
  void shutdown(1)
})

process.on('unhandledRejection', (error) => {
  console.error(error)
  void shutdown(1)
})

try {
  await setupTestDatabase()
  seedBaseline()
  startApp()
} catch (error) {
  console.error(error)
  await shutdown(1)
}
