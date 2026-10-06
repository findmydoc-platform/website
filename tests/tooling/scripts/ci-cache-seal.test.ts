import { afterEach, describe, expect, it } from 'vitest'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const directories: string[] = []
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

describe('encrypted compiler cache transfer', () => {
  it('round-trips compiler packs without exposing their key material in the uploaded envelope', () => {
    const directory = mkdtempSync(join(tmpdir(), 'cache-seal-test-'))
    directories.push(directory)
    mkdirSync(join(directory, '.next/cache/webpack'), { recursive: true })
    const secret = randomBytes(32).toString('base64')
    const pack = Buffer.from(`fixture-key:${secret}`)
    writeFileSync(join(directory, '.next/cache/webpack/fixture.pack'), pack)
    const env = {
      ...process.env,
      GITHUB_ACTIONS: 'true',
      CI_CACHE_EXPERIMENT: '1',
      RUNNER_TEMP: directory,
      GITHUB_SHA: 'a'.repeat(40),
      PAYLOAD_SECRET: secret,
    }
    const script = resolve('scripts/ci-cache-seal.mjs')
    execFileSync(process.execPath, [resolve('scripts/ci-cache-seal.mjs'), '--command', 'seal'], { cwd: directory, env })
    expect(readFileSync(join(directory, 'ci-cache-sealed/compiler.bin')).includes(pack)).toBe(false)
    expect(readFileSync(join(directory, 'ci-cache-sealed/envelope.json'), 'utf8')).not.toContain(secret)
    rmSync(join(directory, '.next/cache'), { recursive: true })
    execFileSync(process.execPath, [script, '--command', 'unseal'], { cwd: directory, env })
    expect(readFileSync(join(directory, '.next/cache/webpack/fixture.pack'))).toEqual(pack)
    const ciphertext = readFileSync(join(directory, 'ci-cache-sealed/compiler.bin'))
    ciphertext.writeUInt8(ciphertext.readUInt8(0) ^ 1, 0)
    writeFileSync(join(directory, 'ci-cache-sealed/compiler.bin'), ciphertext)
    rmSync(join(directory, '.next/cache'), { recursive: true })
    const failed = spawnSync(process.execPath, [script, '--command', 'unseal'], {
      cwd: directory,
      env,
      encoding: 'utf8',
    })
    expect(failed.status).toBe(1)
    expect(failed.stderr).not.toContain(secret)
  })
})
