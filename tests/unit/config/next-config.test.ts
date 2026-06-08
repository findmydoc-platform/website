import { describe, expect, it } from 'vitest'

import nextConfig from '../../../next.config.js'
import { getAllowedDevOrigins } from '@/utilities/nextDevOrigins.js'

describe('nextConfig', () => {
  it('includes seed assets in API output tracing', () => {
    expect(nextConfig.outputFileTracingIncludes?.['/api/**/*']).toContain('./src/endpoints/seed/assets/**/*')
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
