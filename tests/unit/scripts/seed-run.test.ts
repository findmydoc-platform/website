import { describe, expect, it } from 'vitest'

import {
  assertSeedRunPolicy,
  parseSeedRunArgs,
  resolveSeedRuntimeEnv,
  type SeedRuntimeEnv,
} from '../../../scripts/seed-run'

describe('seed-run argument parsing', () => {
  it('parses baseline type with explicit runtime env', () => {
    const options = parseSeedRunArgs(['--type', 'baseline', '--runtime-env', 'preview'])

    expect(options).toEqual({
      type: 'baseline',
      reset: false,
      runtimeEnv: 'preview',
    })
  })

  it('supports inline options and reset flag', () => {
    const options = parseSeedRunArgs(['--type=demo', '--runtime-env=development', '--reset'])

    expect(options).toEqual({
      type: 'demo',
      reset: true,
      runtimeEnv: 'development',
    })
  })

  it('supports explicit boolean reset values', () => {
    const options = parseSeedRunArgs(['--type', 'baseline', '--reset', 'false'])

    expect(options).toEqual({
      type: 'baseline',
      reset: false,
      runtimeEnv: undefined,
    })
  })

  it('throws when type is missing', () => {
    expect(() => parseSeedRunArgs(['--reset'])).toThrow('Missing required option --type <baseline|demo>')
  })

  it('throws on unknown options', () => {
    expect(() => parseSeedRunArgs(['--type', 'baseline', '--unknown'])).toThrow('Unknown option: --unknown')
  })
})

describe('seed-run runtime detection', () => {
  it('uses explicit runtime env when provided', () => {
    const result = resolveSeedRuntimeEnv('test', {
      NODE_ENV: 'production',
      VERCEL_ENV: 'production',
    } as NodeJS.ProcessEnv)

    expect(result).toBe('test')
  })

  it('prefers VERCEL_ENV when valid', () => {
    const result = resolveSeedRuntimeEnv(undefined, {
      VERCEL_ENV: 'preview',
      NODE_ENV: 'production',
    } as NodeJS.ProcessEnv)

    expect(result).toBe('preview')
  })

  it('falls back to DEPLOYMENT_ENV before NODE_ENV', () => {
    const result = resolveSeedRuntimeEnv(undefined, {
      DEPLOYMENT_ENV: 'preview',
      NODE_ENV: 'production',
    } as NodeJS.ProcessEnv)

    expect(result).toBe('preview')
  })

  it('falls back to NODE_ENV and defaults to development', () => {
    const fromNode = resolveSeedRuntimeEnv(undefined, { NODE_ENV: 'test' } as unknown as NodeJS.ProcessEnv)
    const defaulted = resolveSeedRuntimeEnv(undefined, { NODE_ENV: 'staging' } as unknown as NodeJS.ProcessEnv)

    expect(fromNode).toBe('test')
    expect(defaulted).toBe('development')
  })
})

describe('seed-run policy guards', () => {
  const production: SeedRuntimeEnv = 'production'

  it('blocks demo in production', () => {
    expect(() => assertSeedRunPolicy({ runtimeEnv: production, type: 'demo', reset: false })).toThrow(
      'Demo seeding is disabled in production runtime',
    )
  })

  it('blocks reset in production', () => {
    expect(() => assertSeedRunPolicy({ runtimeEnv: production, type: 'baseline', reset: true })).toThrow(
      'Seed reset is disabled in production runtime',
    )
  })

  it('allows baseline in non-production', () => {
    expect(() => assertSeedRunPolicy({ runtimeEnv: 'preview', type: 'baseline', reset: false })).not.toThrow()
  })
})
