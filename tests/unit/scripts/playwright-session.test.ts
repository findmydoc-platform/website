import type { APIRequestContext } from '@playwright/test'
import { describe, expect, it } from 'vitest'

import {
  getDefaultStateFile,
  getPlaywrightSessionCheckUrl,
  getPlaywrightSessionLoginUrl,
  isAuthenticatedPlaywrightSessionUrl,
  isValidPlaywrightSessionForPersona,
  parsePlaywrightSessionArgs,
} from '../../../scripts/playwright-session'

const createRequestContext = (
  responses: Record<
    string,
    {
      body?: unknown
      ok: boolean
    }
  >,
) =>
  ({
    get: async (path: string) => {
      const response = responses[path]

      return {
        json: async () => response?.body ?? {},
        ok: () => response?.ok ?? false,
      }
    },
  }) as unknown as APIRequestContext

describe('playwright-session argument parsing', () => {
  it('uses admin defaults when no options are provided', () => {
    expect(parsePlaywrightSessionArgs([])).toEqual({
      baseUrl: 'http://localhost:3000/',
      help: false,
      persona: 'admin',
      stateFile: getDefaultStateFile('admin'),
    })
  })

  it('supports explicit base url and state file', () => {
    expect(
      parsePlaywrightSessionArgs([
        '--persona=admin',
        '--base-url',
        'http://127.0.0.1:3001',
        '--state-file',
        'tmp/admin-session.json',
      ]),
    ).toEqual({
      baseUrl: 'http://127.0.0.1:3001/',
      help: false,
      persona: 'admin',
      stateFile: 'tmp/admin-session.json',
    })
  })

  it('supports clinic persona defaults', () => {
    expect(parsePlaywrightSessionArgs(['--persona', 'clinic'])).toEqual({
      baseUrl: 'http://localhost:3000/',
      help: false,
      persona: 'clinic',
      stateFile: getDefaultStateFile('clinic'),
    })
  })

  it('ignores shell argument separators', () => {
    expect(parsePlaywrightSessionArgs(['--', '--persona', 'admin'])).toMatchObject({
      persona: 'admin',
    })
  })

  it('marks help requests', () => {
    expect(parsePlaywrightSessionArgs(['--help']).help).toBe(true)
  })

  it('throws on unsupported personas', () => {
    expect(() => parsePlaywrightSessionArgs(['--persona', 'patient'])).toThrow('Invalid --persona value: patient')
  })
})

describe('playwright-session URLs', () => {
  it('builds admin login and check urls from the local base url', () => {
    expect(getPlaywrightSessionLoginUrl('admin', 'http://localhost:3000/')).toBe('http://localhost:3000/admin/login')
    expect(getPlaywrightSessionCheckUrl('admin', 'http://localhost:3000/')).toBe('http://localhost:3000/admin')
    expect(getPlaywrightSessionLoginUrl('clinic', 'http://localhost:3000/')).toBe('http://localhost:3000/admin/login')
    expect(getPlaywrightSessionCheckUrl('clinic', 'http://localhost:3000/')).toBe('http://localhost:3000/admin')
  })

  it('accepts authenticated admin urls', () => {
    expect(isAuthenticatedPlaywrightSessionUrl('http://localhost:3000/admin', 'admin', 'http://localhost:3000/')).toBe(
      true,
    )
    expect(
      isAuthenticatedPlaywrightSessionUrl(
        'http://localhost:3000/admin/collections/basicUsers',
        'admin',
        'http://localhost:3000/',
      ),
    ).toBe(true)
    expect(isAuthenticatedPlaywrightSessionUrl('http://localhost:3000/admin', 'clinic', 'http://localhost:3000/')).toBe(
      true,
    )
  })

  it('accepts admin persona sessions only when basicUsers stays readable', async () => {
    const request = createRequestContext({
      '/api/basicUsers?depth=0&limit=1': {
        body: { docs: [] },
        ok: true,
      },
    })

    await expect(
      isValidPlaywrightSessionForPersona('http://localhost:3000/admin', 'admin', 'http://localhost:3000/', request),
    ).resolves.toBe(true)
  })

  it('rejects clinic persona validation when basicUsers is still readable', async () => {
    const request = createRequestContext({
      '/api/basicUsers?depth=0&limit=1': {
        body: { docs: [{ id: 'admin-user' }] },
        ok: true,
      },
      '/api/clinicStaff?depth=1&limit=1': {
        body: { docs: [{ clinic: { id: 'clinic-1' } }] },
        ok: true,
      },
    })

    await expect(
      isValidPlaywrightSessionForPersona('http://localhost:3000/admin', 'clinic', 'http://localhost:3000/', request),
    ).resolves.toBe(false)
  })

  it('accepts clinic persona validation only with a clinic staff assignment', async () => {
    const request = createRequestContext({
      '/api/basicUsers?depth=0&limit=1': {
        ok: false,
      },
      '/api/clinicStaff?depth=1&limit=1': {
        body: { docs: [{ clinic: { id: 'clinic-1' } }] },
        ok: true,
      },
    })

    await expect(
      isValidPlaywrightSessionForPersona('http://localhost:3000/admin', 'clinic', 'http://localhost:3000/', request),
    ).resolves.toBe(true)
  })

  it('rejects login, first-admin, and cross-origin urls', () => {
    expect(
      isAuthenticatedPlaywrightSessionUrl('http://localhost:3000/admin/login', 'admin', 'http://localhost:3000/'),
    ).toBe(false)
    expect(
      isAuthenticatedPlaywrightSessionUrl('http://localhost:3000/admin/first-admin', 'admin', 'http://localhost:3000/'),
    ).toBe(false)
    expect(isAuthenticatedPlaywrightSessionUrl('http://example.com/admin', 'admin', 'http://localhost:3000/')).toBe(
      false,
    )
  })
})
