import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'
import type { Page } from 'playwright'
import { DEFAULT_DISCOVERY_PROBE_FILE, DEFAULT_USER_AGENT } from '../config'
import { resolveStateFile, stateFileExists } from '../session/storage'
import type { GitHubTarget, GitHubUploadTokenContext } from '../types'

const DISCOVERY_TIMEOUT_MS = 45_000
const PROBE_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII='

type CapturedPolicyRequest = {
  headers: Record<string, string>
  postData?: string
}

const extractMultipartField = (text: string | undefined, fieldName: string): string | undefined => {
  if (!text) {
    return undefined
  }

  const pattern = new RegExp(`name="${fieldName}"\\r?\\n\\r?\\n([^\\r\\n-]+)`)
  return text.match(pattern)?.[1]
}

const ensureProbeFile = async (): Promise<string> => {
  const absoluteProbeFile = path.resolve(process.cwd(), DEFAULT_DISCOVERY_PROBE_FILE)
  await mkdir(path.dirname(absoluteProbeFile), { recursive: true })
  await writeFile(absoluteProbeFile, Buffer.from(PROBE_PNG_BASE64, 'base64'), { mode: 0o600 })
  return absoluteProbeFile
}

const waitForCommentEditor = async (page: Page): Promise<void> => {
  await page
    .locator('textarea, [contenteditable="true"], input[type="file"]')
    .last()
    .waitFor({ state: 'attached', timeout: 20_000 })
}

const focusLikelyEditor = async (page: Page): Promise<void> => {
  await page
    .getByText('Add a comment', { exact: false })
    .last()
    .click({ timeout: 2_000 })
    .catch(() => undefined)
  await page
    .locator('textarea, [contenteditable="true"]')
    .last()
    .click({ timeout: 2_000 })
    .catch(() => undefined)
}

const triggerFileUploadInput = async (page: Page, probeFile: string): Promise<boolean> => {
  const fileInputs = page.locator('input[type="file"]')
  const count = await fileInputs.count()
  if (count === 0) {
    return false
  }

  await fileInputs.nth(count - 1).setInputFiles(probeFile)
  return true
}

const triggerPasteOrDropUpload = async (page: Page): Promise<void> => {
  await focusLikelyEditor(page)
  await page.evaluate(
    ({ base64, fileName }) => {
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
      const file = new File([bytes], fileName, { type: 'image/png' })
      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(file)
      const target =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : document.querySelector<HTMLElement>('textarea, [contenteditable="true"]')

      if (!target) {
        throw new Error('No GitHub comment editor target found for paste/drop upload discovery')
      }

      target.dispatchEvent(
        new ClipboardEvent('paste', {
          bubbles: true,
          cancelable: true,
          clipboardData: dataTransfer,
        }),
      )
      target.dispatchEvent(
        new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          dataTransfer,
        }),
      )
    },
    { base64: PROBE_PNG_BASE64, fileName: 'upload-token-probe.png' },
  )
}

const captureUploadPolicyRequest = async (page: Page, trigger: () => Promise<void>): Promise<CapturedPolicyRequest> => {
  let captured: CapturedPolicyRequest | undefined
  let resolveCaptured: (() => void) | undefined

  const capturedPromise = new Promise<void>((resolve) => {
    resolveCaptured = resolve
  })

  await page.route('**/upload/policies/assets', async (route) => {
    const request = route.request()
    captured = {
      headers: request.headers(),
      postData: request.postData() ?? undefined,
    }
    resolveCaptured?.()
    await route.abort('aborted')
  })

  try {
    await trigger()
    await Promise.race([
      capturedPromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timed out waiting for GitHub upload policy request')), DISCOVERY_TIMEOUT_MS),
      ),
    ])
  } finally {
    await page.unroute('**/upload/policies/assets').catch(() => undefined)
  }

  if (!captured) {
    throw new Error('GitHub upload policy request was not captured')
  }

  return captured
}

export const discoverUploadTokenWithBrowserSession = async (options: {
  stateFile: string
  target: GitHubTarget
}): Promise<GitHubUploadTokenContext> => {
  if (!(await stateFileExists(options.stateFile))) {
    throw new Error(`No stored GitHub web session found at ${options.stateFile}; run bootstrap-session first`)
  }

  const probeFile = await ensureProbeFile()
  const browser = await chromium.launch({ headless: true })

  try {
    const context = await browser.newContext({
      storageState: resolveStateFile(options.stateFile),
      userAgent: DEFAULT_USER_AGENT,
    })
    const page = await context.newPage()

    await page.goto(options.target.url, { waitUntil: 'domcontentloaded' })
    if (new URL(page.url()).pathname.startsWith('/login')) {
      throw new Error('Stored GitHub web session is not logged in; run bootstrap-session again')
    }

    await waitForCommentEditor(page)
    const captured = await captureUploadPolicyRequest(page, async () => {
      const triggeredInput = await triggerFileUploadInput(page, probeFile)
      if (!triggeredInput) {
        await triggerPasteOrDropUpload(page)
      }
    })

    return {
      clientVersion: captured.headers['x-github-client-version'],
      cookieHeader: captured.headers.cookie,
      fetchNonce: captured.headers['x-fetch-nonce'],
      repositoryId: extractMultipartField(captured.postData, 'repository_id'),
      target: options.target,
      uploadAuthenticityToken: extractMultipartField(captured.postData, 'authenticity_token'),
    }
  } finally {
    await browser.close()
  }
}
