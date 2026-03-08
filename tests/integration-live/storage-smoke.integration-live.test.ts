import { execSync } from 'child_process'
import { describe, expect, it } from 'vitest'

const isLive = process.env.STORAGE_LIVE_TESTS === 'true'
const describeLive = isLive ? describe : describe.skip

describeLive('storage smoke live lane', () => {
  it('runs the MinIO-backed storage smoke script successfully', () => {
    const output = execSync('pnpm dlx tsx scripts/storage-smoke.ts', {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: 'development',
        PAYLOAD_SECRET: process.env.PAYLOAD_SECRET ?? 'dev-secret',
        STORAGE_SMOKE_AUTO_CREATE_BUCKET: 'true',
        USE_S3_IN_DEV: 'true',
      },
      stdio: 'pipe',
    }).toString()

    expect(output).toContain('[storage:smoke] mode=cloud')
    expect(output).toContain('[storage:smoke] verified bucket=')
    expect(output).toContain('[storage:smoke] completed')
  })
})
