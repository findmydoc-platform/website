import { appendFileSync } from 'node:fs'

const now = process.hrtime.bigint
export async function measurePhase<T>(filename: string, phase: string, callback: () => Promise<T>): Promise<T> {
  const started = now()
  let status = 'failed'
  try {
    const result = await callback()
    status = 'passed'
    return result
  } finally {
    if (process.env.DOMAIN_POC_PHASES)
      appendFileSync(
        process.env.DOMAIN_POC_PHASES,
        JSON.stringify({ filename, phase, status, durationMs: Number(now() - started) / 1e6 }) + '\n',
      )
  }
}
