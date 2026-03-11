#!/usr/bin/env node
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { chromium } from 'playwright'
import {
  ensureScreenshotsSection,
  findNewUrls,
  parseCliArgs,
  parseImageUrls,
  resolveUiChange,
  validateScreenshotsSection,
  isAbsolutePath,
} from './lib/pr-screenshot-upload-lib.mjs'

function runGh(args) {
  return execFileSync('gh', args, { encoding: 'utf8' }).trim()
}

function fail(reason, nextStep, details = undefined) {
  const payload = {
    ok: false,
    error: {
      reason,
      next_step: nextStep,
      ...(details ? { details } : {}),
    },
  }
  console.error(JSON.stringify(payload, null, 2))
  process.exit(1)
}

function loadPr(selector) {
  const args = selector
    ? ['pr', 'view', selector, '--json', 'number,url,body,headRefName,baseRefName']
    : ['pr', 'view', '--json', 'number,url,body,headRefName,baseRefName']
  const raw = runGh(args)
  return JSON.parse(raw)
}

function loadChangedFiles(selector) {
  const args = selector ? ['pr', 'diff', selector, '--name-only'] : ['pr', 'diff', '--name-only']
  const raw = runGh(args)
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function updatePrBody(selector, body) {
  const tempPath = `${process.cwd()}/.tmp-pr-body-${Date.now()}.md`
  fs.writeFileSync(tempPath, body, 'utf8')
  try {
    const args = selector ? ['pr', 'edit', selector, '--body-file', tempPath] : ['pr', 'edit', '--body-file', tempPath]
    runGh(args)
  } finally {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath)
  }
}

async function openEditor(page, prUrl, timeoutMs) {
  await page.goto(prUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs })

  const signInVisible = await page
    .getByRole('heading', { name: /sign in to github/i })
    .isVisible()
    .catch(() => false)
  if (signInVisible) {
    fail('GitHub session is not authenticated in browser.', 'Sign in to GitHub in the opened browser and retry.')
  }

  const editCandidates = [
    page.locator('.js-comment-container .js-comment-edit-button').first(),
    page.getByRole('button', { name: /^edit$/i }).first(),
    page.locator('button[aria-label*="Edit"]').first(),
  ]

  let clicked = false
  for (const candidate of editCandidates) {
    if ((await candidate.count()) > 0) {
      try {
        await candidate.click({ timeout: 5000 })
        clicked = true
        break
      } catch {
        // Continue trying candidates.
      }
    }
  }

  if (!clicked) {
    fail(
      'Could not open PR description editor.',
      'Open the PR in browser, enter edit mode manually once, and rerun the command.',
    )
  }

  const textarea = page.locator('textarea#pull_request_body, textarea[name="pull_request[body]"]').first()
  await textarea.waitFor({ state: 'visible', timeout: timeoutMs })
  return textarea
}

async function uploadScreenshotsWithPlaywright(prUrl, screenshotPaths, timeoutMs, headless) {
  const browser = await chromium.launch({ headless })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    const textarea = await openEditor(page, prUrl, timeoutMs)

    const currentBody = (await textarea.inputValue()) || ''
    const ensured = ensureScreenshotsSection(currentBody)
    if (ensured.changed) {
      await textarea.fill(ensured.body)
    }

    const beforeBody = (await textarea.inputValue()) || ''
    validateScreenshotsSection(beforeBody)

    await textarea.focus()
    await page.evaluate(
      (element) => {
        const target = element
        target.selectionStart = target.value.length
        target.selectionEnd = target.value.length
      },
      await textarea.elementHandle(),
    )

    const form = textarea.locator('xpath=ancestor::form[1]')
    let fileInput = form.locator('input[type="file"]').first()

    if ((await fileInput.count()) === 0) {
      const attachButton = form
        .locator(
          'button[aria-label*="Attach files"], summary[aria-label*="Attach files"], label[for*="upload-manifest-file-input"]',
        )
        .first()

      if ((await attachButton.count()) > 0) {
        await attachButton.click({ timeout: 5000 }).catch(() => {})
      }
      fileInput = form.locator('input[type="file"]').first()
    }

    if ((await fileInput.count()) === 0) {
      fail(
        'Could not find file upload input in PR description editor.',
        'Open PR description editor and ensure attachment upload is available.',
      )
    }

    await fileInput.setInputFiles(screenshotPaths)

    await page.waitForFunction(
      () => {
        const textareaNode = document.querySelector('textarea#pull_request_body, textarea[name="pull_request[body]"]')
        if (!textareaNode) return false
        return /https:\/\/(github\.com\/user-attachments\/assets|user-images\.githubusercontent\.com|private-user-images\.githubusercontent\.com)\//.test(
          textareaNode.value,
        )
      },
      { timeout: timeoutMs },
    )

    const saveButton = form
      .locator('button[type="submit"], button:has-text("Update comment"), button:has-text("Save")')
      .first()
    await saveButton.click({ timeout: timeoutMs })

    await page.waitForTimeout(1500)
  } finally {
    await context.close()
    await browser.close()
  }
}

async function main() {
  let options
  try {
    options = parseCliArgs(process.argv.slice(2))
  } catch (error) {
    fail(
      error.message,
      'Use: --pr <num|url> --screenshot <abs-path> [--screenshot <abs-path>] [--ui-change auto|true|false]',
    )
  }

  if (options.screenshotPaths.some((filePath) => !isAbsolutePath(filePath))) {
    fail('All screenshot_paths must be absolute paths.', 'Pass absolute paths like /Users/.../shot.png.')
  }

  for (const filePath of options.screenshotPaths) {
    if (!fs.existsSync(filePath)) {
      fail(`Screenshot file not found: ${filePath}`, 'Create the screenshot file first, then rerun.')
    }
  }

  const pr = loadPr(options.pr)
  const changedFiles = loadChangedFiles(options.pr)
  const isUiChange = resolveUiChange(options.uiChange, options.screenshotPaths, changedFiles)

  if (!isUiChange) {
    const payload = {
      ok: true,
      skipped: true,
      reason: 'No UI change detected and ui_change was not forced.',
      pr: {
        number: pr.number,
        url: pr.url,
      },
    }
    console.log(JSON.stringify(payload, null, 2))
    return
  }

  if (options.screenshotPaths.length === 0) {
    fail(
      'UI change detected but screenshot_paths is empty.',
      'Capture screenshots first and pass at least one absolute path via --screenshot.',
      { pr: pr.url },
    )
  }

  const ensured = ensureScreenshotsSection(pr.body ?? '')
  if (ensured.changed) {
    updatePrBody(options.pr, ensured.body)
  }

  await uploadScreenshotsWithPlaywright(pr.url, options.screenshotPaths, options.timeoutMs, options.headless)

  const updatedPr = loadPr(options.pr)
  const validation = validateScreenshotsSection(updatedPr.body ?? '')

  if (!validation.valid) {
    fail(validation.reason, 'Open PR description and fix the Screenshots section, then rerun validation.', {
      pr: updatedPr.url,
    })
  }

  const previousUrls = parseImageUrls(pr.body ?? '')
  const uploadedUrls = findNewUrls(previousUrls, validation.urls)

  if (uploadedUrls.length === 0) {
    fail(
      'No newly uploaded GitHub image URLs detected after Playwright upload.',
      'Reopen PR editor, upload screenshots again, and rerun the command.',
      { pr: updatedPr.url },
    )
  }

  const payload = {
    ok: true,
    pr: {
      number: updatedPr.number,
      url: updatedPr.url,
    },
    uploaded_urls: uploadedUrls,
  }

  console.log(JSON.stringify(payload, null, 2))
}

main().catch((error) => {
  fail(
    error instanceof Error ? error.message : 'Unexpected error during screenshot upload.',
    'Check GitHub auth/session and rerun command.',
  )
})
