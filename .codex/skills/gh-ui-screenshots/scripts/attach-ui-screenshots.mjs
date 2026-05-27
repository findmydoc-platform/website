#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { File } from 'node:buffer'
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const GITHUB_ORIGIN = 'https://github.com'
const LOGIN_URL = 'https://github.com/login'
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36'
const CODEX_HOME = process.env.CODEX_HOME || path.join(os.homedir(), '.codex')
const CACHE_DIR = path.join(CODEX_HOME, 'cache', 'gh-ui-screenshots')
const STATE_FILE = path.join(CACHE_DIR, 'github.storage-state.json')
const PROBE_FILE = path.join(CACHE_DIR, 'upload-token-probe.png')
const PLAYWRIGHT_VERSION = '1.60.0'
const MARKER_START = '<!-- gh-ui-screenshots:start -->'
const MARKER_END = '<!-- gh-ui-screenshots:end -->'
const IMAGE_EXTENSIONS = new Set(['.gif', '.jpg', '.jpeg', '.png', '.svg', '.webp'])
const CONTENT_TYPES = new Map([
  ['.gif', 'image/gif'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
])
const ARTIFACT_DIRS = ['output/playwright', 'test-results', 'playwright-report', 'tmp']
const PROBE_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII='
const COMMAND = 'node .codex/skills/gh-ui-screenshots/scripts/attach-ui-screenshots.mjs'

const fail = (message) => {
  console.error(`error=${redactSecrets(message)}`)
  process.exit(1)
}

const info = (message) => {
  console.log(redactSecrets(message))
}

const reportNoScreenshotsFound = () => {
  info('no_screenshots_found=true')
  info('pr_body_unchanged=true')
  info('next_step=ask_user_whether_screenshot_evidence_is_needed_or_rerun_with_--image')
}

const redactSecrets = (value) =>
  String(value)
    .replace(/(user_session=)[^;\s]+/g, '$1[REDACTED]')
    .replace(/(_gh_sess=)[^;\s]+/g, '$1[REDACTED]')
    .replace(/(authorization:\s*Bearer\s+)[^\s]+/gi, '$1[REDACTED]')
    .replace(/("Authorization"\s*:\s*"Bearer\s+)[^"]+/gi, '$1[REDACTED]')
    .replace(/("value"\s*:\s*")[^"]{24,}/g, '$1[REDACTED]')

const helpText = `GitHub UI screenshot attachment helper.

Usage:
  ${COMMAND} --pr current --image <path[:label]> [--image <path[:label]>]
  ${COMMAND} --pr <number|url> --image <path[:label]>
  ${COMMAND} --pr <number|url|current> --bootstrap-session

Options:
  --pr <target>                 PR number, PR URL, or current branch PR. Default: current.
  --image <path[:label]>        Existing screenshot file. Repeat for multiple images.
                                If omitted and no artifact images exist, the script exits without changing the PR.
  --dry-run                     Resolve PR and images without uploading or patching.
  --bootstrap-session           Open browser login and save GitHub web session cookies.
  --browser-channel <channel>   msedge, chrome, or chromium. Default: env or msedge/chrome fallback.
  --help                        Show this help.
`

const parseArgs = (argv) => {
  const options = {
    browserChannel: process.env.GH_UI_SCREENSHOTS_BROWSER_CHANNEL,
    bootstrapSession: false,
    dryRun: false,
    images: [],
    pr: 'current',
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--help' || arg === '-h') {
      options.help = true
      continue
    }

    if (arg === '--dry-run') {
      options.dryRun = true
      continue
    }

    if (arg === '--bootstrap-session') {
      options.bootstrapSession = true
      continue
    }

    if (arg === '--pr' || arg === '--image' || arg === '--browser-channel') {
      const value = argv[index + 1]
      if (!value || value.startsWith('--')) {
        fail(`missing value for ${arg}`)
      }

      if (arg === '--pr') options.pr = value
      if (arg === '--image') options.images.push(value)
      if (arg === '--browser-channel') options.browserChannel = value
      index += 1
      continue
    }

    fail(`unknown argument: ${arg}`)
  }

  return options
}

const execJson = (command, args, options = {}) => {
  const output = execFileSync(command, args, { encoding: 'utf8', ...options })
  return JSON.parse(output)
}

const execText = (command, args, options = {}) => execFileSync(command, args, { encoding: 'utf8', ...options }).trim()

const ghToken = () => execText('gh', ['auth', 'token'])

const githubApi = async (token, apiPath, options = {}) => {
  const response = await fetch(`https://api.github.com${apiPath}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'gh-ui-screenshots-skill',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {}),
    },
  })
  const text = await response.text()
  const payload = text ? JSON.parse(text) : undefined

  if (!response.ok) {
    throw new Error(`GitHub API ${apiPath} failed: ${response.status} ${JSON.stringify(payload)}`)
  }

  return payload
}

const parsePrUrl = (value) => {
  const match = value.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/)
  if (!match) return undefined
  return { owner: match[1], repo: match[2], number: Number(match[3]) }
}

const resolveCurrentRepo = () => {
  const repo = execJson('gh', ['repo', 'view', '--json', 'nameWithOwner'])
  const [owner, name] = repo.nameWithOwner.split('/')
  return { owner, repo: name }
}

const resolvePullRequest = async (token, prValue) => {
  if (prValue === 'current') {
    const pr = execJson('gh', ['pr', 'view', '--json', 'number,url,body,title,headRefName,baseRefName'])
    const parsed = parsePrUrl(pr.url)
    if (!parsed) {
      throw new Error('Could not parse current PR URL from gh pr view')
    }
    return { ...parsed, ...pr, htmlUrl: pr.url }
  }

  const parsedUrl = parsePrUrl(prValue)
  const target = parsedUrl || { ...resolveCurrentRepo(), number: Number(prValue) }

  if (!Number.isFinite(target.number)) {
    throw new Error('PR target must be current, a number, or a GitHub pull request URL')
  }

  const pr = await githubApi(token, `/repos/${target.owner}/${target.repo}/pulls/${target.number}`)
  return {
    baseRefName: pr.base?.ref,
    body: pr.body || '',
    headRefName: pr.head?.ref,
    htmlUrl: pr.html_url,
    number: pr.number,
    owner: target.owner,
    repo: target.repo,
    title: pr.title,
    url: pr.html_url,
  }
}

const parseImageArg = (value) => {
  const separator = value.lastIndexOf(':')
  const hasLabel =
    separator > 0 &&
    separator < value.length - 1 &&
    !value.slice(separator + 1).includes('/') &&
    !value.slice(separator + 1).includes('\\')
  const filePath = hasLabel ? value.slice(0, separator) : value
  const label = hasLabel ? value.slice(separator + 1) : undefined
  return resolveImage(filePath, label)
}

const resolveImage = (filePath, label) => {
  const absolutePath = path.resolve(process.cwd(), filePath)
  const stats = statSync(absolutePath)
  if (!stats.isFile()) {
    throw new Error(`Image path is not a file: ${filePath}`)
  }
  const extension = path.extname(absolutePath).toLowerCase()
  const contentType = CONTENT_TYPES.get(extension)
  if (!contentType) {
    throw new Error(`Unsupported image type: ${extension || 'none'}`)
  }
  if (stats.size <= 0) {
    throw new Error(`Image file is empty: ${filePath}`)
  }
  return {
    contentType,
    label: normalizeLabel(label || path.basename(absolutePath, extension)),
    name: path.basename(absolutePath),
    path: absolutePath,
    size: stats.size,
  }
}

const normalizeLabel = (value) =>
  String(value)
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase()) || 'Screenshot'

const findImagesRecursive = (directory, results = []) => {
  if (!existsSync(directory)) return results
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      findImagesRecursive(fullPath, results)
      continue
    }
    const extension = path.extname(entry.name).toLowerCase()
    if (!IMAGE_EXTENSIONS.has(extension)) continue
    if (/probe|test-pixel/i.test(entry.name)) continue
    const stats = statSync(fullPath)
    if (stats.size < 1024) continue
    results.push({ path: fullPath, mtimeMs: stats.mtimeMs })
  }
  return results
}

const resolveImages = (imageArgs) => {
  if (imageArgs.length > 0) {
    return imageArgs.map(parseImageArg)
  }

  const discovered = ARTIFACT_DIRS.flatMap((dir) => findImagesRecursive(path.resolve(process.cwd(), dir)))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(0, 4)

  if (discovered.length === 0) {
    return []
  }

  return discovered.map((image) => resolveImage(image.path))
}

const ensureCacheDir = () => {
  mkdirSync(CACHE_DIR, { recursive: true })
  if (!existsSync(PROBE_FILE)) {
    writeFileSync(PROBE_FILE, Buffer.from(PROBE_PNG_BASE64, 'base64'), { mode: 0o600 })
  }
}

const ensurePlaywrightCore = async () => {
  ensureCacheDir()
  const packagePath = path.join(CACHE_DIR, 'node_modules', 'playwright-core', 'index.js')
  if (!existsSync(packagePath)) {
    if (!existsSync(path.join(CACHE_DIR, 'package.json'))) {
      writeFileSync(path.join(CACHE_DIR, 'package.json'), '{"private":true,"type":"module"}\n')
    }
    info(`installing_playwright_core_cache=${CACHE_DIR}`)
    execFileSync('npm', ['install', `playwright-core@${PLAYWRIGHT_VERSION}`, '--no-audit', '--no-fund', '--silent'], {
      cwd: CACHE_DIR,
      stdio: 'inherit',
    })
  }
  const playwright = await import(pathToFileURL(packagePath).href)
  return playwright.chromium ? playwright : playwright.default
}

const browserChannels = (requested) => {
  if (requested) return [requested]
  return ['msedge', 'chrome']
}

const launchPersistentContext = async (chromium, profileDir, requestedChannel) => {
  let lastError
  for (const channel of browserChannels(requestedChannel)) {
    try {
      const context = await chromium.launchPersistentContext(profileDir, {
        args: ['--start-maximized', '--window-position=80,80'],
        channel,
        headless: false,
        slowMo: 100,
        viewport: null,
      })
      return { channel, context }
    } catch (error) {
      lastError = error
    }
  }
  throw new Error(`Could not launch a supported browser channel. Last error: ${lastError?.message}`)
}

const launchHeadlessBrowser = async (chromium, requestedChannel) => {
  let lastError
  for (const channel of browserChannels(requestedChannel)) {
    try {
      const browser = await chromium.launch({ channel, headless: true })
      return { browser, channel }
    } catch (error) {
      lastError = error
    }
  }
  throw new Error(`Could not launch a supported headless browser channel. Last error: ${lastError?.message}`)
}

const buildLoginUrl = (returnToUrl) => {
  const login = new URL(LOGIN_URL)
  const target = new URL(returnToUrl)
  login.searchParams.set('return_to', `${target.pathname}${target.search}${target.hash}`)
  return login.toString()
}

const waitForUserSession = async (context) => {
  const startedAt = Date.now()
  while (Date.now() - startedAt < 15 * 60 * 1000) {
    const cookies = await context.cookies(GITHUB_ORIGIN)
    if (cookies.some((cookie) => cookie.name === 'user_session')) return
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  throw new Error('Timed out waiting for GitHub user_session cookie')
}

const bootstrapSession = async (targetUrl, requestedChannel) => {
  const { chromium } = await ensurePlaywrightCore()
  const profileDir = path.join(CACHE_DIR, `browser-profile-${requestedChannel || 'auto'}`)
  mkdirSync(profileDir, { recursive: true })
  const { channel, context } = await launchPersistentContext(chromium, profileDir, requestedChannel)
  info(`browser_channel=${channel}`)
  try {
    const page = await context.newPage()
    await page.goto(buildLoginUrl(targetUrl), { waitUntil: 'domcontentloaded' })
    await page.bringToFront()
    info('complete_github_login=true')
    await waitForUserSession(context)
    const storageState = await context.storageState()
    writeFileSync(STATE_FILE, JSON.stringify(storageState, null, 2), { mode: 0o600 })
    chmodSync(STATE_FILE, 0o600)
    info(`saved_session=${STATE_FILE}`)
  } finally {
    await context.close()
  }
}

const readStorageState = () => {
  if (!existsSync(STATE_FILE)) {
    throw new Error(`No GitHub web session at ${STATE_FILE}`)
  }
  return JSON.parse(readFileSync(STATE_FILE, 'utf8'))
}

const isGitHubCookie = (cookie) => {
  const domain = cookie.domain || ''
  return domain === 'github.com' || domain.endsWith('.github.com')
}

const isExpired = (cookie) => {
  if (cookie.expires === undefined || cookie.expires < 0) return false
  return cookie.expires <= Math.floor(Date.now() / 1000)
}

const buildCookieHeader = () => {
  const state = readStorageState()
  const cookies = (state.cookies || []).filter((cookie) => isGitHubCookie(cookie) && !isExpired(cookie))
  if (!cookies.some((cookie) => cookie.name === 'user_session')) {
    throw new Error('Stored GitHub web session is missing user_session')
  }
  if (!cookies.some((cookie) => cookie.name === '_gh_sess')) {
    throw new Error('Stored GitHub web session is missing _gh_sess')
  }
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ')
}

const extractMultipartField = (text, fieldName) => {
  const pattern = new RegExp(`name="${fieldName}"\\r?\\n\\r?\\n([^\\r\\n-]+)`)
  return text?.match(pattern)?.[1]
}

const focusEditor = async (page) => {
  await page
    .getByText('Add a comment', { exact: false })
    .last()
    .click({ timeout: 2000 })
    .catch(() => undefined)
  await page
    .locator('textarea, [contenteditable="true"]')
    .last()
    .click({ timeout: 2000 })
    .catch(() => undefined)
}

const triggerPasteOrDropUpload = async (page) => {
  await focusEditor(page)
  await page.evaluate(
    ({ base64 }) => {
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
      const file = new File([bytes], 'upload-token-probe.png', { type: 'image/png' })
      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(file)
      const target =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : document.querySelector('textarea, [contenteditable="true"]')
      if (!target) throw new Error('No GitHub comment editor target found')
      target.dispatchEvent(
        new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dataTransfer }),
      )
      target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }))
    },
    { base64: PROBE_PNG_BASE64 },
  )
}

const discoverUploadToken = async (targetUrl, requestedChannel) => {
  const { chromium } = await ensurePlaywrightCore()
  const { browser, channel } = await launchHeadlessBrowser(chromium, requestedChannel)
  info(`headless_browser_channel=${channel}`)

  try {
    const context = await browser.newContext({
      storageState: STATE_FILE,
      userAgent: USER_AGENT,
    })
    const page = await context.newPage()
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' })
    if (new URL(page.url()).pathname.startsWith('/login')) {
      throw new Error('Stored GitHub web session is not logged in')
    }

    await page.locator('textarea, [contenteditable="true"], input[type="file"]').last().waitFor({
      state: 'attached',
      timeout: 20000,
    })

    let captured
    await page.route('**/upload/policies/assets', async (route) => {
      const request = route.request()
      captured = {
        headers: request.headers(),
        postData: request.postData() || undefined,
      }
      await route.abort('aborted')
    })

    const fileInputs = page.locator('input[type="file"]')
    const inputCount = await fileInputs.count()
    if (inputCount > 0) {
      await fileInputs.nth(inputCount - 1).setInputFiles(PROBE_FILE)
    } else {
      await triggerPasteOrDropUpload(page)
    }

    const startedAt = Date.now()
    while (!captured && Date.now() - startedAt < 45000) {
      await new Promise((resolve) => setTimeout(resolve, 250))
    }

    if (!captured) {
      throw new Error('Timed out waiting for GitHub upload policy request')
    }

    return {
      clientVersion: captured.headers['x-github-client-version'],
      cookieHeader: captured.headers.cookie || buildCookieHeader(),
      fetchNonce: captured.headers['x-fetch-nonce'],
      repositoryId: extractMultipartField(captured.postData, 'repository_id'),
      uploadAuthenticityToken: extractMultipartField(captured.postData, 'authenticity_token'),
    }
  } finally {
    await browser.close()
  }
}

const requestUploadPolicy = async (context, image) => {
  const form = new FormData()
  form.set('repository_id', context.repositoryId)
  form.set('name', image.name)
  form.set('size', String(image.size))
  form.set('content_type', image.contentType)
  if (context.uploadAuthenticityToken) {
    form.set('authenticity_token', context.uploadAuthenticityToken)
  }

  const response = await fetch(`${GITHUB_ORIGIN}/upload/policies/assets`, {
    body: form,
    headers: {
      accept: '*/*',
      cookie: context.cookieHeader,
      'github-verified-fetch': 'true',
      origin: GITHUB_ORIGIN,
      referer: context.referer,
      'sec-ch-ua': '"Chromium";v="148", "HeadlessChrome";v="148", "Not/A)Brand";v="99"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
      'user-agent': USER_AGENT,
      'x-fetch-nonce': context.fetchNonce || '',
      'x-github-client-version': context.clientVersion || '',
      'x-requested-with': 'XMLHttpRequest',
    },
    method: 'POST',
  })
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`Upload policy failed: ${response.status} ${text.slice(0, 500)}`)
  }
  return JSON.parse(text)
}

const uploadFileToS3 = async (policy, image) => {
  const form = new FormData()
  for (const [key, value] of Object.entries(policy.form)) {
    form.set(key, value)
  }
  form.set('file', new File([readFileSync(image.path)], image.name, { type: image.contentType }))
  const response = await fetch(policy.upload_url, {
    body: form,
    headers: {
      accept: '*/*',
      origin: GITHUB_ORIGIN,
      referer: GITHUB_ORIGIN,
      'user-agent': USER_AGENT,
    },
    method: 'POST',
  })
  if (!response.ok && response.status !== 204) {
    const text = await response.text()
    throw new Error(`S3 upload failed: ${response.status} ${text.slice(0, 500)}`)
  }
  return response.status
}

const finalizeAsset = async (context, policy) => {
  const form = new FormData()
  form.set('authenticity_token', policy.asset_upload_authenticity_token)
  const response = await fetch(new URL(policy.asset_upload_url, GITHUB_ORIGIN), {
    body: form,
    headers: {
      accept: 'application/json',
      cookie: context.cookieHeader,
      'github-verified-fetch': 'true',
      origin: GITHUB_ORIGIN,
      referer: context.referer,
      'sec-ch-ua': '"Chromium";v="148", "HeadlessChrome";v="148", "Not/A)Brand";v="99"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
      'user-agent': USER_AGENT,
      'x-fetch-nonce': context.fetchNonce || '',
      'x-github-client-version': context.clientVersion || '',
      'x-requested-with': 'XMLHttpRequest',
    },
    method: 'PUT',
  })
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`Asset finalize failed: ${response.status} ${text.slice(0, 500)}`)
  }
  return response.status
}

const uploadImage = async (context, image) => {
  const policy = await requestUploadPolicy(context, image)
  if (!policy.upload_url || !policy.asset?.href || !policy.asset_upload_url) {
    throw new Error('Upload policy response is missing required fields')
  }
  const s3Status = await uploadFileToS3(policy, image)
  const finalStatus = await finalizeAsset(context, policy)
  return {
    href: policy.asset.href,
    label: image.label,
    markdown: `![${image.label}](${policy.asset.href})`,
    s3Status,
    finalStatus,
  }
}

const markerPattern = () =>
  new RegExp(`\\n?[ \\t]*${escapeRegExp(MARKER_START)}[\\s\\S]*?[ \\t]*${escapeRegExp(MARKER_END)}\\n?`, 'g')

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const renderMarkerBlock = (uploads) => {
  const lines = [
    `  ${MARKER_START}`,
    ...uploads.map((upload) => `  - ${upload.label}: ${upload.markdown}`),
    `  ${MARKER_END}`,
  ]
  return lines.join('\n')
}

const patchPrBody = (body, uploads) => {
  const block = renderMarkerBlock(uploads)
  const cleaned = (body || '').replace(markerPattern(), '\n')
  const uiLinePattern = /^(\s*-\s*\[)( |x|X)(\]\s*UI\/mobile QA:\s*)(.*)$/m
  const match = cleaned.match(uiLinePattern)
  if (match) {
    const existingText = match[4]?.trim()
    const line = `${match[1]}x${match[3]}${existingText || 'Screenshots attached below.'}`
    return cleaned.replace(uiLinePattern, `${line}\n${block}`)
  }

  const validationPattern = /(## Validation\s*\n)/i
  const inserted = `- [x] UI/mobile QA: Screenshots attached below.\n${block}\n`
  if (validationPattern.test(cleaned)) {
    return cleaned.replace(validationPattern, `$1\n${inserted}`)
  }

  return `${cleaned.trimEnd()}\n\n## Validation\n\n${inserted}`
}

const updatePrBody = async (token, pr, uploads) => {
  const body = patchPrBody(pr.body || '', uploads)
  const updated = await githubApi(token, `/repos/${pr.owner}/${pr.repo}/pulls/${pr.number}`, {
    body: JSON.stringify({ body }),
    headers: { 'Content-Type': 'application/json' },
    method: 'PATCH',
  })
  return updated.html_url
}

const resolveRepositoryId = async (token, pr) => {
  try {
    const repo = await githubApi(token, `/repos/${pr.owner}/${pr.repo}`)
    return String(repo.id)
  } catch {
    return undefined
  }
}

const requireStoredWebSession = (pr) => {
  try {
    buildCookieHeader()
  } catch (error) {
    throw new Error(`${error.message}. Run: ${COMMAND} --pr ${pr.htmlUrl} --bootstrap-session`)
  }
}

const buildUploadContext = async (token, pr, browserChannel) => {
  const repositoryId = await resolveRepositoryId(token, pr)
  requireStoredWebSession(pr)

  const tokenContext = await discoverUploadToken(pr.htmlUrl, browserChannel)
  const context = {
    clientVersion: tokenContext.clientVersion,
    cookieHeader: tokenContext.cookieHeader,
    fetchNonce: tokenContext.fetchNonce,
    referer: pr.htmlUrl,
    repositoryId: tokenContext.repositoryId || repositoryId,
    uploadAuthenticityToken: tokenContext.uploadAuthenticityToken,
  }

  if (!context.repositoryId) {
    throw new Error('Could not resolve GitHub repository id for upload policy')
  }

  return context
}

const uploadImages = async (context, images) => {
  const uploads = []
  for (const image of images) {
    const upload = await uploadImage(context, image)
    uploads.push(upload)
    info(`uploaded=${upload.href} s3_status=${upload.s3Status} finalize_status=${upload.finalStatus}`)
  }
  return uploads
}

const attachScreenshotsToPr = async ({ browserChannel, images, pr, token }) => {
  const context = await buildUploadContext(token, pr, browserChannel)
  const uploads = await uploadImages(context, images)
  const url = await updatePrBody(token, pr, uploads)
  info(`pr_body_updated=${url}`)
}

const main = async () => {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    console.log(helpText)
    return
  }

  const token = ghToken()
  const pr = await resolvePullRequest(token, options.pr)
  info(`pr=${pr.htmlUrl}`)

  if (options.bootstrapSession) {
    await bootstrapSession(pr.htmlUrl, options.browserChannel)
    return
  }

  const images = resolveImages(options.images)
  if (images.length === 0) {
    reportNoScreenshotsFound()
    return
  }
  info(`images=${images.map((image) => image.path).join(',')}`)

  if (options.dryRun) {
    info('dry_run=true')
    return
  }

  await attachScreenshotsToPr({
    browserChannel: options.browserChannel,
    images,
    pr,
    token,
  })
}

main().catch((error) => fail(error.message || error))
