import { describe, expect, it } from 'vitest'

import {
  buildScreenshotMetadata,
  patchPrBody,
  renderMarkerBlock,
} from '../../../.codex/skills/gh-ui-screenshots/scripts/attach-ui-screenshots.mjs'

describe('gh-ui-screenshots release metadata', () => {
  it('marks a compact release-primary PNG as release eligible', () => {
    const metadata = buildScreenshotMetadata({
      contentType: 'image/png',
      filePath: 'output/playwright/clinic-registration-step3-mobile.png',
      gitSha: '79d6c744',
      height: 844,
      label: 'Clinic registration step 3',
      mtimeMs: Date.parse('2026-06-04T17:42:00Z'),
      releaseRole: 'primary',
      size: 72 * 1024,
      width: 390,
    })

    expect(metadata).toMatchObject({
      focus: 'clinic-registration-step-3',
      formFactor: 'mobile',
      gitSha: '79d6c744',
      releaseEligible: true,
      releaseRole: 'primary',
      uploadName: 'clinic-registration-step-3__mobile__390x844__20260604T174200Z__79d6c744__390x844__72kb.png',
      viewport: '390x844',
      warnings: [],
    })
  })

  it('warns but does not block oversized or too-tall screenshots', () => {
    const metadata = buildScreenshotMetadata({
      contentType: 'image/png',
      filePath: 'output/playwright/full-page-mobile.png',
      gitSha: '79d6c744',
      height: 2400,
      label: 'Full page mobile',
      releaseRole: 'primary',
      size: 2 * 1024 * 1024,
      width: 390,
    })

    expect(metadata.releaseEligible).toBe(false)
    expect(metadata.warnings).toEqual(['too_large', 'too_tall', 'unsupported_aspect_ratio'])
  })

  it('renders screenshot metadata inside the existing marker block', () => {
    const markerBlock = renderMarkerBlock([
      {
        href: 'https://github.com/user-attachments/assets/example',
        label: 'Clinic registration step 3',
        markdown: '![Clinic registration step 3](https://github.com/user-attachments/assets/example)',
        metadata: {
          focus: 'clinic-registration-step-3',
          formFactor: 'mobile',
          releaseEligible: true,
          releaseRole: 'primary',
          url: 'https://github.com/user-attachments/assets/example',
          warnings: [],
        },
      },
    ])

    expect(markerBlock).toContain('<!-- gh-ui-screenshots:start -->')
    expect(markerBlock).toContain('<!-- gh-ui-screenshots:metadata {')
    expect(markerBlock).toContain('"releaseEligible":true')
    expect(markerBlock).toContain('![Clinic registration step 3]')
  })

  it('patches screenshot evidence under the UI/mobile QA validation item', () => {
    const body = `## Management summary

Release value.

## Validation

- [ ] UI/mobile QA: Narrow and desktop screenshots reviewed.
- [x] Tests: Unit tests passed.
`

    const patched = patchPrBody(body, [
      {
        href: 'https://github.com/user-attachments/assets/example',
        label: 'Clinic registration step 3',
        markdown: '![Clinic registration step 3](https://github.com/user-attachments/assets/example)',
        metadata: {
          focus: 'clinic-registration-step-3',
          formFactor: 'mobile',
          releaseEligible: true,
          releaseRole: 'primary',
          url: 'https://github.com/user-attachments/assets/example',
          warnings: [],
        },
      },
    ])

    expect(patched).toContain('- [x] UI/mobile QA: Narrow and desktop screenshots reviewed.')
    expect(patched).toContain('  <!-- gh-ui-screenshots:start -->')
    expect(patched).toContain('  ![Clinic registration step 3]')
    expect(patched).not.toContain('## UI/UX')
  })
})
