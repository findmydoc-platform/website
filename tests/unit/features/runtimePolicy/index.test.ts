import { describe, expect, it } from 'vitest'
import {
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

  it('exposes fixed auth/logging policy profiles', () => {
    expect(RUNTIME_POLICY.preview.auth.enablePreviewGuard).toBe(true)
    expect(RUNTIME_POLICY.preview.logging.defaultLevel).toBe('info')
    expect(RUNTIME_POLICY.nonPreview.auth.allowPlatformEmailReconcile).toBe(false)
    expect(RUNTIME_POLICY.nonPreview.logging.defaultLevel).toBe('warn')
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
