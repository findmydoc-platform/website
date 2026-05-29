import { describe, expect, it } from 'vitest'
import {
  allowsPlatformEmailReconcile,
  resolveClientRuntimeClass,
  resolveClientRuntimeEnvironment,
  resolveRuntimeClass,
  resolveSeedRuntimePolicy,
  resolveServerRuntimeEnvironment,
  RUNTIME_POLICY,
} from '@/features/runtimePolicy'

describe('runtimePolicy', () => {
  it('prefers VERCEL_ENV over DEPLOYMENT_ENV for server runtime resolution', () => {
    const runtimeEnvironment = resolveServerRuntimeEnvironment({
      VERCEL_ENV: 'production',
      DEPLOYMENT_ENV: 'preview',
      NODE_ENV: 'development',
    })

    expect(runtimeEnvironment).toBe('production')
  })

  it('resolves preview runtime class for server preview env', () => {
    expect(
      resolveRuntimeClass({
        VERCEL_ENV: 'preview',
        DEPLOYMENT_ENV: undefined,
        NODE_ENV: 'production',
      }),
    ).toBe('preview')
  })

  it('resolves nonPreview runtime class for non-preview envs', () => {
    expect(
      resolveRuntimeClass({
        VERCEL_ENV: 'production',
        DEPLOYMENT_ENV: undefined,
        NODE_ENV: 'production',
      }),
    ).toBe('nonPreview')
  })

  it('uses NODE_ENV only for development and test fallback', () => {
    expect(resolveServerRuntimeEnvironment({ NODE_ENV: 'preview' })).toBe('development')
    expect(resolveServerRuntimeEnvironment({ NODE_ENV: 'production' })).toBe('development')
    expect(resolveServerRuntimeEnvironment({ NODE_ENV: 'test' })).toBe('test')
  })

  it('uses NEXT_PUBLIC envs for client runtime resolution', () => {
    const runtimeEnvironment = resolveClientRuntimeEnvironment({
      NEXT_PUBLIC_VERCEL_ENV: undefined,
      NEXT_PUBLIC_DEPLOYMENT_ENV: 'preview',
      NODE_ENV: 'development',
    })
    const runtimeClass = resolveClientRuntimeClass({
      NEXT_PUBLIC_VERCEL_ENV: undefined,
      NEXT_PUBLIC_DEPLOYMENT_ENV: 'preview',
      NODE_ENV: 'development',
    })

    expect(runtimeEnvironment).toBe('preview')
    expect(runtimeClass).toBe('preview')
  })

  it('uses NODE_ENV only for client development and test fallback', () => {
    expect(resolveClientRuntimeEnvironment({ NODE_ENV: 'preview' })).toBe('development')
    expect(resolveClientRuntimeEnvironment({ NODE_ENV: 'production' })).toBe('development')
    expect(resolveClientRuntimeEnvironment({ NODE_ENV: 'test' })).toBe('test')
  })

  it('exposes fixed auth/logging policy profiles', () => {
    expect(RUNTIME_POLICY.preview.auth.allowPlatformEmailReconcile).toBe(true)
    expect(RUNTIME_POLICY.preview.logging.defaultLevel).toBe('info')
    expect(RUNTIME_POLICY.nonPreview.auth.allowPlatformEmailReconcile).toBe(false)
    expect(RUNTIME_POLICY.nonPreview.logging.defaultLevel).toBe('warn')
  })

  it('allows platform email reconciliation only in preview and test runtimes', () => {
    expect(allowsPlatformEmailReconcile({ DEPLOYMENT_ENV: 'preview' })).toBe(true)
    expect(allowsPlatformEmailReconcile({ DEPLOYMENT_ENV: 'test' })).toBe(true)
    expect(allowsPlatformEmailReconcile({ DEPLOYMENT_ENV: 'production' })).toBe(false)
    expect(allowsPlatformEmailReconcile({ DEPLOYMENT_ENV: 'development' })).toBe(false)
  })

  it('returns strict seed runtime policy for production and open policy for preview', () => {
    expect(resolveSeedRuntimePolicy('production')).toEqual({
      allowBaseline: true,
      allowDemo: false,
      allowEndpointPost: true,
      allowReset: false,
    })

    expect(resolveSeedRuntimePolicy('preview')).toEqual({
      allowBaseline: true,
      allowDemo: true,
      allowEndpointPost: true,
      allowReset: true,
    })
  })
})
