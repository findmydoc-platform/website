import dgram from 'node:dgram'
import dns from 'node:dns'
import http from 'node:http'
import http2 from 'node:http2'
import https from 'node:https'
import { syncBuiltinESMExports } from 'node:module'
import net from 'node:net'
import tls from 'node:tls'
import { inspect } from 'node:util'
import { vi, type MockInstance } from 'vitest'

type SocketOptions = { host?: unknown; path?: unknown; port?: unknown }
const safeTestDatabaseNamePattern = /^findmydoc-test(?:[-_][a-z0-9][a-z0-9_-]*)?$/

function isSafeTestDatabaseUrl(databaseUrl: URL) {
  const databaseName = decodeURIComponent(databaseUrl.pathname.slice(1)).toLowerCase()
  const localHost = ['127.0.0.1', '::1', '[::1]', 'localhost'].includes(databaseUrl.hostname)
  return databaseUrl.protocol.startsWith('postgres') && localHost && safeTestDatabaseNamePattern.test(databaseName)
}

function configuredTestDatabaseUrl(): URL | undefined {
  const connectionString = process.env.DATABASE_URI
  if (!connectionString) return undefined
  try {
    const databaseUrl = new URL(connectionString)
    return isSafeTestDatabaseUrl(databaseUrl) ? databaseUrl : undefined
  } catch {
    return undefined
  }
}

export function isAllowedTestDatabaseConnection(args: unknown[], databaseUrl = configuredTestDatabaseUrl()) {
  if (!databaseUrl || !isSafeTestDatabaseUrl(databaseUrl)) return false
  const target = args[0]
  const options = typeof target === 'object' && target !== null ? (target as SocketOptions) : undefined
  if (typeof target === 'string' || typeof options?.path === 'string') return false
  const host =
    typeof options?.host === 'string'
      ? options.host
      : typeof target === 'number' && typeof args[1] === 'string'
        ? args[1]
        : 'localhost'
  const port =
    typeof options?.port === 'number' || typeof options?.port === 'string'
      ? Number(options.port)
      : typeof target === 'number'
        ? target
        : 5432
  const configuredPort = Number(databaseUrl.port || '5432')
  return host === databaseUrl.hostname && port === configuredPort
}

export function installExternalNetworkGuard(scope: string) {
  const attemptedProtocols = new Set<string>()
  const guards: MockInstance[] = []
  let firstAttemptStack: string | undefined
  const deny = (protocol: string): never => {
    attemptedProtocols.add(protocol)
    firstAttemptStack ??= new Error(`External ${protocol} call`).stack
    throw new Error(`External ${protocol} network forbidden by ${scope}`)
  }
  const track = <T extends MockInstance>(guard: T): T => {
    guards.push(guard)
    return guard
  }

  const install = () => {
    if (guards.length > 0) return
    const databaseUrl = configuredTestDatabaseUrl()
    const originalSocketConnect = net.Socket.prototype.connect
    const originalDnsLookup = dns.lookup
    const originalDnsPromiseLookup = dns.promises.lookup

    track(vi.spyOn(globalThis, 'fetch').mockImplementation(() => deny('fetch')))
    track(vi.spyOn(http, 'request').mockImplementation(() => deny('http.request')))
    track(vi.spyOn(http, 'get').mockImplementation(() => deny('http.get')))
    track(vi.spyOn(https, 'request').mockImplementation(() => deny('https.request')))
    track(vi.spyOn(https, 'get').mockImplementation(() => deny('https.get')))
    track(vi.spyOn(http2, 'connect').mockImplementation(() => deny('http2.connect')))
    track(
      vi.spyOn(net.Socket.prototype, 'connect').mockImplementation(function (this: net.Socket, ...args: unknown[]) {
        if (!isAllowedTestDatabaseConnection(args, databaseUrl)) return deny('socket.connect')
        return Reflect.apply(originalSocketConnect, this, args) as net.Socket
      } as typeof net.Socket.prototype.connect),
    )
    track(vi.spyOn(tls, 'connect').mockImplementation(() => deny('tls.connect')))
    track(
      vi.spyOn(dns, 'lookup').mockImplementation(((hostname: string, ...args: unknown[]) => {
        if (!databaseUrl || hostname !== databaseUrl.hostname) return deny('dns.lookup')
        return Reflect.apply(originalDnsLookup, dns, [hostname, ...args])
      }) as typeof dns.lookup),
    )
    track(
      vi.spyOn(dns.promises, 'lookup').mockImplementation((async (hostname: string) => {
        if (!databaseUrl || hostname !== databaseUrl.hostname) return deny('dns.promises.lookup')
        return originalDnsPromiseLookup(hostname)
      }) as never),
    )
    for (const method of [
      'resolve',
      'resolve4',
      'resolve6',
      'resolveAny',
      'resolveCaa',
      'resolveCname',
      'resolveMx',
      'resolveNaptr',
      'resolveNs',
      'resolvePtr',
      'resolveSoa',
      'resolveSrv',
      'resolveTxt',
      'reverse',
    ] as const) {
      track(vi.spyOn(dns, method).mockImplementation(() => deny(`dns.${method}`)) as MockInstance)
      track(vi.spyOn(dns.promises, method).mockImplementation(() => deny(`dns.promises.${method}`)) as MockInstance)
      track(
        vi
          .spyOn(dns.Resolver.prototype, method)
          .mockImplementation(() => deny(`dns.Resolver.${method}`)) as MockInstance,
      )
      track(
        vi
          .spyOn(dns.promises.Resolver.prototype, method)
          .mockImplementation(() => deny(`dns.promises.Resolver.${method}`)) as MockInstance,
      )
    }
    track(vi.spyOn(dgram.Socket.prototype, 'send').mockImplementation(() => deny('dgram.send')))
    syncBuiltinESMExports()
  }

  const restore = () => {
    for (const guard of guards.splice(0)) guard.mockRestore()
    syncBuiltinESMExports()
  }

  install()
  return {
    assertNoAttempts() {
      if (attemptedProtocols.size !== 0)
        throw new Error(
          `External network attempt reached ${scope}: ${[...attemptedProtocols].join(', ')}\n${firstAttemptStack ?? ''}`,
        )
    },
    isInstalled() {
      return guards.length > 0
    },
    reinstall() {
      restore()
      install()
    },
    resetAttempts() {
      attemptedProtocols.clear()
      firstAttemptStack = undefined
    },
    restore,
  }
}

export function assertNoPrivateEvidence(value: unknown, forbiddenValues: unknown[]) {
  const evidence = inspect(value, { depth: null, getters: false, maxArrayLength: null, maxStringLength: null })
  const escaped = forbiddenValues.some(
    (forbidden) => typeof forbidden === 'string' && forbidden.length > 0 && evidence.includes(forbidden),
  )
  if (escaped) throw new Error('Private delivery evidence escaped the tested boundary')
}
