import { describe, expect, it } from 'vitest'

import {
  getDefaultStateFile,
  getPlaywrightSessionCheckUrl,
  getPlaywrightSessionLoginUrl,
  isAuthenticatedPlaywrightSessionUrl,
  parsePlaywrightSessionArgs,
} from '../../../scripts/playwright-session'

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
