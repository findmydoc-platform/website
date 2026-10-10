import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

import nextConfig, { isPreviewDeployment } from '../../../next.config.js'
import vercelConfig from '../../../vercel.json'
import { getAllowedDevOrigins } from '@/utilities/nextDevOrigins.js'

const matchGlob = createRequire(import.meta.url)('next/dist/compiled/picomatch') as (
  patterns: string | string[],
  options?: { contains?: boolean; dot?: boolean },
) => (value: string) => boolean

describe('nextConfig', () => {
  it('includes seed assets in API output tracing', () => {
    expect(nextConfig.outputFileTracingIncludes?.['/api/**/*']).toContain('./src/endpoints/seed/assets/**/*')
  })

  it('keeps ignored environment files out of every server trace while retaining runtime assets', () => {
    const exclusions = Object.entries(nextConfig.outputFileTracingExcludes ?? {})
    const routes = ['/', '/posts/[slug]', '/admin/[[...segments]]', '/api/clinics']
    const environmentFiles = ['.env', '.env.example', '.env.test', '.vercel/.env.preview.local']
    const runtimeAsset = 'src/endpoints/seed/assets/clinic.jpg'

    for (const route of routes) {
      const patterns = exclusions
        .filter(([routeGlob]) => matchGlob(routeGlob, { contains: true, dot: true })(route))
        .flatMap(([, files]) => files)
      const isExcluded = matchGlob(patterns, { contains: true, dot: true })

      for (const file of environmentFiles) {
        expect(isExcluded(file), `${route} must exclude ${file}`).toBe(true)
      }
      expect(isExcluded(runtimeAsset)).toBe(false)
    }

    const serverPatterns = exclusions
      .filter(([routeGlob]) => matchGlob(routeGlob)('next-server'))
      .flatMap(([, files]) => files)
    const isExcludedFromServer = matchGlob(serverPatterns, { contains: true, dot: true })

    for (const file of environmentFiles) {
      expect(isExcludedFromServer(file), `next-server must exclude ${file}`).toBe(true)
    }
    expect(isExcludedFromServer(runtimeAsset)).toBe(false)
  })

  it('disables image optimization only for preview deployments', () => {
    expect(
      isPreviewDeployment({
        deploymentEnvironment: 'production',
        vercelEnvironment: 'preview',
      }),
    ).toBe(true)
    expect(
      isPreviewDeployment({
        deploymentEnvironment: 'preview',
        vercelEnvironment: 'production',
      }),
    ).toBe(false)
    expect(
      isPreviewDeployment({
        deploymentEnvironment: 'preview',
        vercelEnvironment: undefined,
      }),
    ).toBe(true)
  })

  it('bounds Payload API workers below the abandoned seed recovery lease', () => {
    expect(vercelConfig.functions['src/app/(payload)/api/**/route.ts'].maxDuration).toBe(300)
  })

  it('auto-allows only private IPv4 dev origins', () => {
    const allowedDevOrigins = getAllowedDevOrigins({
      configuredOrigins: '',
      isDevelopmentRuntime: true,
      networkInterfacesByName: {
        en0: [
          { address: '192.168.0.53', family: 'IPv4', internal: false },
          { address: '10.0.0.5', family: 'IPv4', internal: false },
          { address: '172.16.0.5', family: 'IPv4', internal: false },
          { address: '172.31.255.5', family: 'IPv4', internal: false },
          { address: '172.32.0.5', family: 'IPv4', internal: false },
          { address: '100.64.0.5', family: 'IPv4', internal: false },
          { address: '203.0.113.5', family: 'IPv4', internal: false },
          { address: '127.0.0.1', family: 'IPv4', internal: true },
        ],
      },
    })

    expect(allowedDevOrigins).toEqual(['192.168.0.53', '10.0.0.5', '172.16.0.5', '172.31.255.5'])
  })

  it('normalizes configured private dev hostnames', () => {
    const allowedDevOrigins = getAllowedDevOrigins({
      configuredOrigins: 'private-dev.example.test:3000,vpn.example.local:3000/path',
      isDevelopmentRuntime: true,
      networkInterfacesByName: {},
    })

    expect(allowedDevOrigins).toEqual(['private-dev.example.test', 'vpn.example.local'])
  })

  it('does not set allowed dev origins outside development', () => {
    const allowedDevOrigins = getAllowedDevOrigins({
      configuredOrigins: 'vpn.example.local',
      isDevelopmentRuntime: false,
      networkInterfacesByName: {
        en0: [{ address: '192.168.0.53', family: 'IPv4', internal: false }],
      },
    })

    expect(allowedDevOrigins).toEqual([])
  })
})
