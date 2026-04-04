import path from 'node:path'

export const SUPPORTED_PLAYWRIGHT_SESSION_PERSONAS = ['admin'] as const

export type PlaywrightSessionPersona = (typeof SUPPORTED_PLAYWRIGHT_SESSION_PERSONAS)[number]

export type PlaywrightSessionCliOptions = {
  baseUrl: string
  help: boolean
  persona: PlaywrightSessionPersona
  stateFile: string
}

const DEFAULT_BASE_URL = 'http://localhost:3000/'

const DEFAULT_STATE_FILES: Record<PlaywrightSessionPersona, string> = {
  admin: path.join('output', 'playwright', 'sessions', 'admin.local.json'),
}

const ADMIN_AUTH_BLOCKED_PATHS = new Set(['/admin/login', '/admin/first-admin'])

const stripArgSeparators = (argv: string[]): string[] => argv.filter((arg) => arg !== '--')

const isSupportedPersona = (value: string): value is PlaywrightSessionPersona => {
  return SUPPORTED_PLAYWRIGHT_SESSION_PERSONAS.includes(value as PlaywrightSessionPersona)
}

export const getDefaultStateFile = (persona: PlaywrightSessionPersona): string => DEFAULT_STATE_FILES[persona]

export const normalizeBaseUrl = (value: string): string => {
  const url = new URL(value)
  url.hash = ''
  url.search = ''
  return url.toString()
}

export const getPlaywrightSessionLoginUrl = (persona: PlaywrightSessionPersona, baseUrl: string): string => {
  switch (persona) {
    case 'admin':
      return new URL('/admin/login', baseUrl).toString()
  }
}

export const getPlaywrightSessionCheckUrl = (persona: PlaywrightSessionPersona, baseUrl: string): string => {
  switch (persona) {
    case 'admin':
      return new URL('/admin', baseUrl).toString()
  }
}

export const isAuthenticatedPlaywrightSessionUrl = (
  value: string | URL,
  persona: PlaywrightSessionPersona,
  baseUrl: string,
): boolean => {
  const candidateUrl = typeof value === 'string' ? new URL(value) : value
  const normalizedBaseUrl = new URL(baseUrl)

  if (candidateUrl.origin !== normalizedBaseUrl.origin) {
    return false
  }

  switch (persona) {
    case 'admin':
      return candidateUrl.pathname.startsWith('/admin') && !ADMIN_AUTH_BLOCKED_PATHS.has(candidateUrl.pathname)
  }
}

export function parsePlaywrightSessionArgs(argv: string[]): PlaywrightSessionCliOptions {
  const args = stripArgSeparators(argv)
  let baseUrl = DEFAULT_BASE_URL
  let help = false
  let persona: PlaywrightSessionPersona = 'admin'
  let stateFile: string | undefined

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (!arg) continue

    if (arg === '-h' || arg === '--help') {
      help = true
      continue
    }

    if (arg === '--persona') {
      const value = args[i + 1]
      if (!value) throw new Error('Missing value for --persona')
      if (!isSupportedPersona(value)) {
        throw new Error(`Invalid --persona value: ${value}`)
      }
      persona = value
      i += 1
      continue
    }

    if (arg.startsWith('--persona=')) {
      const value = arg.slice('--persona='.length)
      if (!isSupportedPersona(value)) {
        throw new Error(`Invalid --persona value: ${value}`)
      }
      persona = value
      continue
    }

    if (arg === '--base-url') {
      const value = args[i + 1]
      if (!value) throw new Error('Missing value for --base-url')
      baseUrl = normalizeBaseUrl(value)
      i += 1
      continue
    }

    if (arg.startsWith('--base-url=')) {
      const value = arg.slice('--base-url='.length)
      baseUrl = normalizeBaseUrl(value)
      continue
    }

    if (arg === '--state-file') {
      const value = args[i + 1]
      if (!value) throw new Error('Missing value for --state-file')
      stateFile = value
      i += 1
      continue
    }

    if (arg.startsWith('--state-file=')) {
      stateFile = arg.slice('--state-file='.length)
      continue
    }

    throw new Error(`Unknown option: ${arg}`)
  }

  return {
    baseUrl,
    help,
    persona,
    stateFile: stateFile ?? getDefaultStateFile(persona),
  }
}

export const getPlaywrightSessionHelpText = (mode: 'record' | 'check'): string => {
  const command = `pnpm playwright:session:${mode} -- --persona admin`

  return `\
Manage reusable local Playwright session state for cookie-based admin login.

Usage:
  ${command}

Options:
  --persona <admin>      Persona to record or verify (default: admin)
  --base-url <url>       Base URL for the local app (default: ${DEFAULT_BASE_URL})
  --state-file <path>    Session state path (default: ${getDefaultStateFile('admin')})
  -h, --help             Show this help
`
}
