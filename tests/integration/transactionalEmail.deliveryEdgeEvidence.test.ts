import dgram from 'node:dgram'
import dns from 'node:dns'
import { resolve4 as namedResolve4 } from 'node:dns'
import http, { request as namedHttpRequest } from 'node:http'
import http2, { connect as namedHttp2Connect } from 'node:http2'
import https, { request as namedHttpsRequest } from 'node:https'
import net, { connect as namedNetConnect } from 'node:net'
import tls, { connect as namedTlsConnect } from 'node:tls'
import { inspect } from 'node:util'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  assertNoPrivateEvidence,
  installExternalNetworkGuard,
  isAllowedTestDatabaseConnection,
} from '../helpers/deliveryEdgeEvidence'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('delivery-edge evidence helpers', () => {
  it('normalizes Error details and cyclic evidence before checking private values', () => {
    const privateValue = 'synthetic-private-action-link'
    const evidence: { error: Error; self?: unknown } = { error: new Error(privateValue) }
    evidence.self = evidence

    expect(() => assertNoPrivateEvidence(evidence, [privateValue])).toThrow(
      'Private delivery evidence escaped the tested boundary',
    )
    expect(inspect(evidence)).toContain(privateValue)
  })

  it('installs guards for every supported external transport without making a request', () => {
    const guard = installExternalNetworkGuard('helper contract')

    expect(vi.isMockFunction(globalThis.fetch)).toBe(true)
    expect(vi.isMockFunction(http.request)).toBe(true)
    expect(vi.isMockFunction(http.get)).toBe(true)
    expect(vi.isMockFunction(https.request)).toBe(true)
    expect(vi.isMockFunction(https.get)).toBe(true)
    expect(vi.isMockFunction(http2.connect)).toBe(true)
    expect(vi.isMockFunction(net.Socket.prototype.connect)).toBe(true)
    expect(vi.isMockFunction(tls.connect)).toBe(true)
    expect(vi.isMockFunction(dns.lookup)).toBe(true)
    expect(vi.isMockFunction(dns.resolve)).toBe(true)
    expect(vi.isMockFunction(dns.promises.resolve)).toBe(true)
    expect(vi.isMockFunction(dns.Resolver.prototype.resolve4)).toBe(true)
    expect(vi.isMockFunction(dns.promises.Resolver.prototype.resolve4)).toBe(true)
    expect(vi.isMockFunction(dgram.Socket.prototype.send)).toBe(true)
    expect(vi.isMockFunction(namedHttpRequest)).toBe(true)
    expect(vi.isMockFunction(namedHttpsRequest)).toBe(true)
    expect(vi.isMockFunction(namedHttp2Connect)).toBe(true)
    expect(vi.isMockFunction(namedTlsConnect)).toBe(true)
    expect(vi.isMockFunction(namedResolve4)).toBe(true)

    const callback = () => undefined
    const socket = dgram.createSocket('udp4')
    const resolver = new dns.Resolver()
    const promiseResolver = new dns.promises.Resolver()
    try {
      for (const denied of [
        () => fetch('http://127.0.0.1:9'),
        () => http.request('http://127.0.0.1:9'),
        () => namedHttpRequest('http://127.0.0.1:9'),
        () => https.request('https://127.0.0.1:9'),
        () => namedHttpsRequest('https://127.0.0.1:9'),
        () => http2.connect('http://127.0.0.1:9'),
        () => namedHttp2Connect('http://127.0.0.1:9'),
        () => net.connect(9, '127.0.0.1'),
        () => namedNetConnect(9, '127.0.0.1'),
        () => tls.connect(9, '127.0.0.1'),
        () => namedTlsConnect(9, '127.0.0.1'),
        () => dns.resolve4('guard.invalid', callback),
        () => namedResolve4('guard.invalid', callback),
        () => dns.promises.resolve4('guard.invalid'),
        () => resolver.resolve4('guard.invalid', callback),
        () => promiseResolver.resolve4('guard.invalid'),
        () => socket.send('blocked', 9, '127.0.0.1'),
      ]) {
        expect(denied).toThrow(/network forbidden by helper contract/)
      }
      expect(() => guard.assertNoAttempts()).toThrow(/External network attempt reached helper contract/)
    } finally {
      socket.close()
      guard.restore()
    }
  })

  it('allows only the configured test database socket', () => {
    const databaseUrl = new URL('postgresql://127.0.0.1:55432/findmydoc-test')

    expect(isAllowedTestDatabaseConnection([{ host: '127.0.0.1', port: 55432 }], databaseUrl)).toBe(true)
    expect(isAllowedTestDatabaseConnection([55432, '127.0.0.1'], databaseUrl)).toBe(true)
    expect(isAllowedTestDatabaseConnection([{ host: '127.0.0.1', port: 5432 }], databaseUrl)).toBe(false)
    expect(isAllowedTestDatabaseConnection([{ host: 'localhost', port: 55432 }], databaseUrl)).toBe(false)
    expect(isAllowedTestDatabaseConnection(['/tmp/.s.PGSQL.55432'], databaseUrl)).toBe(false)
    expect(
      isAllowedTestDatabaseConnection(
        [{ host: '127.0.0.1', port: 55432 }],
        new URL('postgresql://127.0.0.1:55432/contest'),
      ),
    ).toBe(false)
    expect(
      isAllowedTestDatabaseConnection(
        [{ host: '127.0.0.1', port: 55432 }],
        new URL('postgresql://127.0.0.1:55432/findmydoc-test_worker-1'),
      ),
    ).toBe(true)
  })
})
