import { readFile } from 'node:fs/promises'
import { DEFAULT_STATE_FILE } from './config'
import { createGitHubComment } from './github-api/issue-comment'
import { parseGitHubTarget, resolveRepositoryIdWithGh } from './github-api/target-resolver'
import { discoverUploadTokenWithBrowserSession } from './github-web/browser-upload-token'
import { fetchGitHubPageContext } from './github-web/page-context'
import { uploadAttachment } from './github-web/upload-attachment'
import { extractUploadTokenContextFromHar, resolveUploadAuthenticityToken } from './github-web/upload-token'
import { fail, info } from './logger'
import { renderAttachmentMarkdown } from './markdown/render-comment'
import { bootstrapGitHubSession } from './session/bootstrap'
import { runGitHubSessionPreflight } from './session/preflight'
import { readGitHubCookieHeaderFromStateFile } from './session/storage'
import type { GitHubPageContext, GitHubUploadContext, GitHubUploadTokenContext } from './types'

type CliOptions = {
  alt?: string
  body?: string
  bodyFile?: string
  browserChannel?: string
  clientVersion?: string
  command: string
  debugHar?: string
  file?: string
  help: boolean
  noComment: boolean
  repositoryId?: string
  stateFile: string
  target?: string
  uploadToken?: string
}

const HELP_TEXT = `\
GitHub user-attachment upload helper.

Usage:
  pnpm github:attachments -- bootstrap-session [--target <github issue/pr url>]
  pnpm github:attachments -- preflight --target <github issue/pr url>
  pnpm github:attachments -- inspect-context --target <github issue/pr url>
  pnpm github:attachments -- discover-upload-token --target <github issue/pr url>
  pnpm github:attachments -- upload --target <github issue/pr url> --file <image> [--body <text>]
  pnpm github:attachments -- upload-only --target <github issue/pr url> --file <image>

Options:
  --target <url>          GitHub issue or pull request URL; bootstrap-session uses it as login return_to.
  --browser-channel <id>  Browser channel for bootstrap-session (chrome, msedge, chromium).
  --file <path>           Local PNG/JPEG/GIF/WebP/SVG file.
  --state-file <path>     Playwright storage state (default: ${DEFAULT_STATE_FILE}).
  --repository-id <id>    GitHub repository database id.
  --client-version <sha>  x-github-client-version override.
  --upload-token <token>  Upload policy authenticity token override (only needed for legacy flows).
  --body <text>           Comment text before the Markdown image.
  --body-file <path>      Comment text file before the Markdown image.
  --alt <text>            Markdown image alt text.
  --no-comment            Upload asset, print Markdown, do not create comment.

Debug:
  --debug-har <path>      Sensitive HAR fallback with a successful /upload/policies/assets request.
`

const stripArgSeparators = (argv: string[]): string[] => argv.filter((arg) => arg !== '--')

const readOptionValue = (args: string[], index: number, option: string): string => {
  const value = args[index + 1]
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${option}`)
  }

  return value
}

const parseArgs = (argv: string[]): CliOptions => {
  const args = stripArgSeparators(argv)
  const firstArg = args[0]
  const command = firstArg && !firstArg.startsWith('-') ? firstArg : 'help'
  const options: CliOptions = {
    command,
    help: command === 'help' || firstArg === '-h' || firstArg === '--help',
    noComment: false,
    stateFile: DEFAULT_STATE_FILE,
  }

  const startIndex = firstArg && !firstArg.startsWith('-') ? 1 : 0

  for (let i = startIndex; i < args.length; i += 1) {
    const arg = args[i]
    if (!arg) continue

    if (arg === '-h' || arg === '--help') {
      options.help = true
      continue
    }

    if (arg === '--no-comment') {
      options.noComment = true
      continue
    }

    if (arg.startsWith('--') && arg.includes('=')) {
      const [key, ...valueParts] = arg.split('=')
      if (!key) {
        throw new Error(`Invalid option: ${arg}`)
      }
      const value = valueParts.join('=')
      assignOption(options, key, value)
      continue
    }

    if (arg.startsWith('--')) {
      const value = readOptionValue(args, i, arg)
      assignOption(options, arg, value)
      i += 1
      continue
    }

    throw new Error(`Unknown positional argument: ${arg}`)
  }

  return options
}

const assignOption = (options: CliOptions, key: string, value: string): void => {
  switch (key) {
    case '--alt':
      options.alt = value
      return
    case '--body':
      options.body = value
      return
    case '--body-file':
      options.bodyFile = value
      return
    case '--browser-channel':
      options.browserChannel = value
      return
    case '--client-version':
      options.clientVersion = value
      return
    case '--debug-har':
      options.debugHar = value
      return
    case '--file':
      options.file = value
      return
    case '--har':
      options.debugHar = value
      return
    case '--repository-id':
      options.repositoryId = value
      return
    case '--state-file':
      options.stateFile = value
      return
    case '--target':
      options.target = value
      return
    case '--upload-token':
      options.uploadToken = value
      return
    default:
      throw new Error(`Unknown option: ${key}`)
  }
}

const requireTarget = (options: CliOptions) => {
  if (!options.target) {
    throw new Error('Missing required --target')
  }

  return parseGitHubTarget(options.target)
}

const resolveCommentBody = async (options: CliOptions): Promise<string | undefined> => {
  if (options.bodyFile) {
    return readFile(options.bodyFile, 'utf8')
  }

  return options.body
}

const resolveHarContext = async (options: CliOptions): Promise<GitHubUploadTokenContext | undefined> => {
  if (!options.debugHar) {
    return undefined
  }

  return extractUploadTokenContextFromHar(options.debugHar)
}

const resolveCookieHeader = async (
  options: CliOptions,
  harContext: GitHubUploadTokenContext | undefined,
): Promise<string> => {
  if (harContext?.cookieHeader) {
    return harContext.cookieHeader
  }

  return readGitHubCookieHeaderFromStateFile(options.stateFile)
}

const resolvePageContext = async (options: CliOptions): Promise<GitHubPageContext> => {
  const target = requireTarget(options)
  const harContext = await resolveHarContext(options)
  const cookieHeader = await resolveCookieHeader(options, harContext)
  const pageContext = await fetchGitHubPageContext(target, cookieHeader)

  return {
    ...pageContext,
    clientVersion: options.clientVersion ?? harContext?.clientVersion ?? pageContext.clientVersion,
    fetchNonce: harContext?.fetchNonce ?? pageContext.fetchNonce,
    repositoryId: options.repositoryId ?? harContext?.repositoryId ?? pageContext.repositoryId,
  }
}

const resolveUploadContext = async (options: CliOptions): Promise<GitHubUploadContext> => {
  const target = requireTarget(options)
  const harContext = await resolveHarContext(options)
  const pageContext = await resolvePageContext(options)
  const configuredUploadToken = resolveUploadAuthenticityToken({
    explicitToken: options.uploadToken,
    harContext,
  })
  const browserTokenContext = configuredUploadToken
    ? undefined
    : await discoverUploadTokenWithBrowserSession({
        stateFile: options.stateFile,
        target,
      })
  const repositoryId =
    options.repositoryId ??
    harContext?.repositoryId ??
    browserTokenContext?.repositoryId ??
    pageContext.repositoryId ??
    (await resolveRepositoryIdWithGh(target))
  const uploadAuthenticityToken = configuredUploadToken ?? browserTokenContext?.uploadAuthenticityToken

  return {
    ...pageContext,
    clientVersion:
      options.clientVersion ??
      harContext?.clientVersion ??
      browserTokenContext?.clientVersion ??
      pageContext.clientVersion,
    cookieHeader: browserTokenContext?.cookieHeader ?? pageContext.cookieHeader,
    fetchNonce: harContext?.fetchNonce ?? browserTokenContext?.fetchNonce ?? pageContext.fetchNonce,
    repositoryId,
    uploadAuthenticityToken,
  }
}

const printContextSummary = (context: GitHubPageContext, tokenAvailable: boolean): void => {
  info(`target=${context.target.owner}/${context.target.repo}#${context.target.number} kind=${context.target.kind}`)
  info(`repository_id=${context.repositoryId ?? 'missing'}`)
  info(`fetch_nonce=${context.fetchNonce ? 'present' : 'missing'}`)
  info(`client_version=${context.clientVersion ? 'present' : 'missing'}`)
  info(`cookie_header=${context.cookieHeader ? 'present' : 'missing'}`)
  info(`upload_authenticity_token=${tokenAvailable ? 'present' : 'missing'}`)
}

const run = async (argv: string[]): Promise<void> => {
  const options = parseArgs(argv)

  if (options.help) {
    info(HELP_TEXT)
    return
  }

  switch (options.command) {
    case 'bootstrap-session': {
      const target = options.target ? requireTarget(options) : undefined
      await bootstrapGitHubSession({
        browserChannel: options.browserChannel,
        stateFile: options.stateFile,
        targetUrl: target?.url,
      })
      info(`saved GitHub web session to ${options.stateFile}`)
      return
    }

    case 'preflight': {
      const target = requireTarget(options)
      const harContext = await resolveHarContext(options)
      const cookieHeader = await resolveCookieHeader(options, harContext)
      const result = await runGitHubSessionPreflight(target.url, cookieHeader)
      info(`status=${result.status} logged_in=${String(result.loggedIn)} final_url=${result.url}`)
      return
    }

    case 'inspect-context': {
      const harContext = await resolveHarContext(options)
      const pageContext = await resolvePageContext(options)
      printContextSummary(pageContext, Boolean(harContext?.uploadAuthenticityToken ?? options.uploadToken))
      return
    }

    case 'discover-upload-token': {
      const target = requireTarget(options)
      const tokenContext = await discoverUploadTokenWithBrowserSession({
        stateFile: options.stateFile,
        target,
      })
      printContextSummary(
        {
          clientVersion: tokenContext.clientVersion,
          cookieHeader: tokenContext.cookieHeader ?? '',
          fetchNonce: tokenContext.fetchNonce,
          referer: target.url,
          repositoryId: tokenContext.repositoryId,
          target,
        },
        Boolean(tokenContext.uploadAuthenticityToken),
      )
      return
    }

    case 'upload':
    case 'upload-only': {
      if (!options.file) {
        throw new Error('Missing required --file')
      }

      const context = await resolveUploadContext(options)
      const uploaded = await uploadAttachment(context, options.file)
      const markdown = renderAttachmentMarkdown({
        altText: options.alt,
        assetHref: uploaded.assetHref,
        body: await resolveCommentBody(options),
      })

      info(`asset_href=${uploaded.assetHref}`)
      info(`s3_status=${uploaded.s3Status} finalize_status=${uploaded.finalStatus}`)

      if (options.command === 'upload-only' || options.noComment) {
        info(markdown)
        return
      }

      await createGitHubComment(context.target, markdown)
      info('comment_created=true')
      return
    }

    default:
      throw new Error(`Unknown command: ${options.command}`)
  }
}

run(process.argv.slice(2)).catch(fail)
