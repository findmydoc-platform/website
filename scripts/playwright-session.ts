import path from 'node:path'

export const SUPPORTED_PLAYWRIGHT_SESSION_PERSONAS = ['admin'] as const

export type PlaywrightSessionPersona = (typeof SUPPORTED_PLAYWRIGHT_SESSION_PERSONAS)[number]

export type PlaywrightSessionCliOptions = {
  baseUrl: string
  help: boolean
  persona: PlaywrightSessionPersona
  stateFile: string
}

export type PlaywrightSessionProvisionCliOptions = {
  email?: string
  firstName: string
  help: boolean
  lastName: string
  metadataFile: string
  password?: string
  persona: PlaywrightSessionPersona
}

export type PlaywrightSessionCleanupCliOptions = {
  clearState: boolean
  email?: string
  help: boolean
  metadataFile: string
  persona: PlaywrightSessionPersona
  userId?: string
}

const DEFAULT_BASE_URL = 'http://localhost:3000/'

const DEFAULT_STATE_FILES: Record<PlaywrightSessionPersona, string> = {
  admin: path.join('output', 'playwright', 'sessions', 'admin.local.json'),
}

const DEFAULT_USER_METADATA_FILES: Record<PlaywrightSessionPersona, string> = {
  admin: path.join('output', 'playwright', 'sessions', 'admin.local.user.json'),
}

const ADMIN_AUTH_BLOCKED_PATHS = new Set(['/admin/login', '/admin/first-admin'])

const stripArgSeparators = (argv: string[]): string[] => argv.filter((arg) => arg !== '--')

const isSupportedPersona = (value: string): value is PlaywrightSessionPersona => {
  return SUPPORTED_PLAYWRIGHT_SESSION_PERSONAS.includes(value as PlaywrightSessionPersona)
}

export const getDefaultStateFile = (persona: PlaywrightSessionPersona): string => DEFAULT_STATE_FILES[persona]

export const getDefaultUserMetadataFile = (persona: PlaywrightSessionPersona): string =>
  DEFAULT_USER_METADATA_FILES[persona]

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

export function parsePlaywrightSessionProvisionArgs(argv: string[]): PlaywrightSessionProvisionCliOptions {
  const args = stripArgSeparators(argv)
  let email: string | undefined
  let firstName = 'Playwright'
  let help = false
  let lastName = 'Session'
  let metadataFile: string | undefined
  let password: string | undefined
  let persona: PlaywrightSessionPersona = 'admin'

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

    if (arg === '--email') {
      const value = args[i + 1]
      if (!value) throw new Error('Missing value for --email')
      email = value
      i += 1
      continue
    }

    if (arg.startsWith('--email=')) {
      email = arg.slice('--email='.length)
      continue
    }

    if (arg === '--password') {
      const value = args[i + 1]
      if (!value) throw new Error('Missing value for --password')
      password = value
      i += 1
      continue
    }

    if (arg.startsWith('--password=')) {
      password = arg.slice('--password='.length)
      continue
    }

    if (arg === '--first-name') {
      const value = args[i + 1]
      if (!value) throw new Error('Missing value for --first-name')
      firstName = value
      i += 1
      continue
    }

    if (arg.startsWith('--first-name=')) {
      firstName = arg.slice('--first-name='.length)
      continue
    }

    if (arg === '--last-name') {
      const value = args[i + 1]
      if (!value) throw new Error('Missing value for --last-name')
      lastName = value
      i += 1
      continue
    }

    if (arg.startsWith('--last-name=')) {
      lastName = arg.slice('--last-name='.length)
      continue
    }

    if (arg === '--metadata-file') {
      const value = args[i + 1]
      if (!value) throw new Error('Missing value for --metadata-file')
      metadataFile = value
      i += 1
      continue
    }

    if (arg.startsWith('--metadata-file=')) {
      metadataFile = arg.slice('--metadata-file='.length)
      continue
    }

    throw new Error(`Unknown option: ${arg}`)
  }

  return {
    email,
    firstName,
    help,
    lastName,
    metadataFile: metadataFile ?? getDefaultUserMetadataFile(persona),
    password,
    persona,
  }
}

export function parsePlaywrightSessionCleanupArgs(argv: string[]): PlaywrightSessionCleanupCliOptions {
  const args = stripArgSeparators(argv)
  let clearState = false
  let email: string | undefined
  let help = false
  let metadataFile: string | undefined
  let persona: PlaywrightSessionPersona = 'admin'
  let userId: string | undefined

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (!arg) continue

    if (arg === '-h' || arg === '--help') {
      help = true
      continue
    }

    if (arg === '--clear-state') {
      clearState = true
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

    if (arg === '--email') {
      const value = args[i + 1]
      if (!value) throw new Error('Missing value for --email')
      email = value
      i += 1
      continue
    }

    if (arg.startsWith('--email=')) {
      email = arg.slice('--email='.length)
      continue
    }

    if (arg === '--user-id') {
      const value = args[i + 1]
      if (!value) throw new Error('Missing value for --user-id')
      userId = value
      i += 1
      continue
    }

    if (arg.startsWith('--user-id=')) {
      userId = arg.slice('--user-id='.length)
      continue
    }

    if (arg === '--metadata-file') {
      const value = args[i + 1]
      if (!value) throw new Error('Missing value for --metadata-file')
      metadataFile = value
      i += 1
      continue
    }

    if (arg.startsWith('--metadata-file=')) {
      metadataFile = arg.slice('--metadata-file='.length)
      continue
    }

    throw new Error(`Unknown option: ${arg}`)
  }

  if (email && userId) {
    throw new Error('Use either --email or --user-id, not both')
  }

  return {
    clearState,
    email,
    help,
    metadataFile: metadataFile ?? getDefaultUserMetadataFile(persona),
    persona,
    userId,
  }
}

export const getPlaywrightSessionHelpText = (mode: 'record' | 'check' | 'provision' | 'cleanup'): string => {
  const command = `pnpm playwright:session:${mode} -- --persona admin`

  if (mode === 'provision') {
    return `\
Provision a disposable local admin account for Playwright verification.

Usage:
  ${command}

Options:
  --persona <admin>         Persona to provision (default: admin)
  --email <value>           Explicit login email (default: autogenerated disposable address)
  --password <value>        Explicit login password (default: autogenerated strong password)
  --first-name <value>      First name for the disposable account (default: Playwright)
  --last-name <value>       Last name for the disposable account (default: Session)
  --metadata-file <path>    Metadata path (default: ${getDefaultUserMetadataFile('admin')})
  -h, --help                Show this help
`
  }

  if (mode === 'cleanup') {
    return `\
Delete a disposable local Playwright admin account and optionally clear local session state.

Usage:
  ${command}

Options:
  --persona <admin>         Persona to clean up (default: admin)
  --email <value>           Delete by login email
  --user-id <value>         Delete by Payload basicUsers id
  --metadata-file <path>    Metadata path (default: ${getDefaultUserMetadataFile('admin')})
  --clear-state             Remove ${getDefaultStateFile('admin')} after cleanup
  -h, --help                Show this help
`
  }

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
