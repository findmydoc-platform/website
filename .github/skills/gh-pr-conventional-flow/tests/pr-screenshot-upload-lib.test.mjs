import test from 'node:test'
import assert from 'node:assert/strict'

import {
  ensureScreenshotsSection,
  findNewUrls,
  parseCliArgs,
  resolveUiChange,
  validateScreenshotsSection,
} from '../scripts/lib/pr-screenshot-upload-lib.mjs'

test('adds missing screenshots section', () => {
  const result = ensureScreenshotsSection('Summary:\n- item')
  assert.equal(result.changed, true)
  assert.match(result.body, /\nScreenshots:\n/)
})

test('detects ui changes from path heuristics in auto mode', () => {
  const detected = resolveUiChange('auto', [], ['src/components/organisms/Test.tsx'])
  assert.equal(detected, true)
})

test('returns false for non-ui paths in auto mode without screenshots', () => {
  const detected = resolveUiChange('auto', [], ['docs/readme.md'])
  assert.equal(detected, false)
})

test('validates github-hosted image urls in screenshots section', () => {
  const body = [
    'Summary:',
    '- value',
    'Screenshots:',
    '![state](https://github.com/user-attachments/assets/abc-123)',
    'Testing:',
    '- done',
  ].join('\n')

  const validation = validateScreenshotsSection(body)
  assert.equal(validation.valid, true)
  if (!validation.valid || !validation.urls) throw new Error(validation.reason)
  assert.equal(validation.urls.length, 1)
})

test('accepts gist-hosted image urls in screenshots section', () => {
  const body = [
    'Screenshots:',
    '![state](https://gist.githubusercontent.com/example/abc/raw/def/pr-731-page.png)',
    'Testing:',
  ].join('\n')

  const validation = validateScreenshotsSection(body)
  assert.equal(validation.valid, true)
})

test('rejects local screenshot paths', () => {
  const body = ['Screenshots:', '![local](./tmp/shot.png)', 'Testing:'].join('\n')
  const validation = validateScreenshotsSection(body)
  assert.equal(validation.valid, false)
})

test('finds new urls compared to previous state', () => {
  const before = ['https://github.com/user-attachments/assets/one']
  const after = ['https://github.com/user-attachments/assets/one', 'https://github.com/user-attachments/assets/two']
  assert.deepEqual(findNewUrls(before, after), ['https://github.com/user-attachments/assets/two'])
})

test('parses cli args with repeated screenshots', () => {
  const args = parseCliArgs([
    '--pr',
    '123',
    '--screenshot',
    '/tmp/a.png',
    '--screenshot',
    '/tmp/b.png',
    '--ui-change',
    'true',
    '--headless',
  ])

  assert.equal(args.pr, '123')
  assert.deepEqual(args.screenshotPaths, ['/tmp/a.png', '/tmp/b.png'])
  assert.equal(args.uiChange, 'true')
  assert.equal(args.headless, true)
})
