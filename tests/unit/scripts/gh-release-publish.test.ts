import { describe, expect, it } from 'vitest'

import {
  buildDryRunPlan,
  buildStakeholderMessage,
  buildStakeholderMessageFromCommits,
  formatChatOverridesForShell,
  parseChatMessageOverrides,
} from '../../../.codex/skills/gh-release-publish/scripts/lib.mjs'

const RELEASE_NOTES = `## ✨ New Features & Capabilities
* feat: cookie consent categories via Payload array by @SebastianSchuetze in https://github.com/findmydoc-platform/website/pull/826
* feat(ui): introduce brand icon replacements by @SebastianSchuetze in https://github.com/findmydoc-platform/website/pull/814
## ✅ Improvements & Fixes
* fix(cookie-consent): stop backfilling optional categories by @SebastianSchuetze in https://github.com/findmydoc-platform/website/pull/834
* fix: trim OpenStreetMap direct href before fallback by @SebastianSchuetze in https://github.com/findmydoc-platform/website/pull/838
* ci: fix workflow actionlint pins by @SebastianSchuetze in https://github.com/findmydoc-platform/website/pull/833
`

describe('gh-release-publish stakeholder messaging', () => {
  it('builds a stakeholder-friendly message from release notes', () => {
    const message = buildStakeholderMessage({
      releaseTag: 'v0.30.0',
      releaseUrl: 'https://github.com/findmydoc-platform/website/releases/tag/v0.30.0',
      siteUrl: 'https://findmydoc.eu',
      releaseNotes: RELEASE_NOTES,
    })

    expect(message).toContain('*findmydoc v0.30.0 ist live*')
    expect(message).toContain('Dieses Release bringt vor allem sichtbare Verbesserungen')
    expect(message).toContain('Datenschutz- und Einwilligungsabläufe')
    expect(message).toContain('<https://findmydoc.eu|findmydoc öffnen>')
    expect(message).not.toContain('actionlint')
  })

  it('supports chat overrides for headline, summary, extra lines, and line removal', () => {
    const message = buildStakeholderMessage({
      releaseTag: 'v0.30.0',
      releaseUrl: 'https://github.com/findmydoc-platform/website/releases/tag/v0.30.0',
      siteUrl: 'https://findmydoc.eu',
      releaseNotes: RELEASE_NOTES,
      overrides: {
        headline: '*Manually approved release*',
        summary: 'Kurzfassung fuer das Team.',
        addLines: ['Manuelle Zusatzinfo fuer Kolleg:innen.'],
        removePatterns: ['Datenschutz- und Einwilligungsabläufe'],
      },
    })

    expect(message).toContain('*Manually approved release*')
    expect(message).toContain('Kurzfassung fuer das Team.')
    expect(message).toContain('- Manuelle Zusatzinfo fuer Kolleg:innen.')
    expect(message).not.toContain('Datenschutz- und Einwilligungsabläufe')
  })

  it('builds a pre-release preview from commit history', () => {
    const message = buildStakeholderMessageFromCommits({
      releaseTag: 'v0.30.1',
      releaseUrl: 'https://github.com/findmydoc-platform/website/releases/tag/v0.30.1',
      siteUrl: 'https://findmydoc.eu',
      commits: [
        {
          subject: 'feat: cookie consent categories via Payload array (#826)',
          type: 'feat',
          level: 'minor',
        },
        {
          subject: 'fix: trim OpenStreetMap direct href before fallback (#838)',
          type: 'fix',
          level: 'patch',
        },
        {
          subject: 'ci: fix workflow actionlint pins (#833)',
          type: 'ci',
          level: 'patch',
        },
      ],
    })

    expect(message).toContain('*findmydoc v0.30.1 ist live*')
    expect(message).toContain('Datenschutz- und Einwilligungsabläufe')
    expect(message).not.toContain('actionlint')
  })

  it('parses and re-renders chat override flags', () => {
    const overrides = parseChatMessageOverrides([
      'node',
      'publish-release.mjs',
      '--chat-headline',
      'Custom headline',
      '--chat-summary',
      'Custom summary',
      '--chat-add-line',
      'Extra line',
      '--chat-add-line',
      'Second extra line',
      '--chat-remove-pattern',
      'privacy',
    ])

    expect(overrides).toEqual({
      headline: 'Custom headline',
      summary: 'Custom summary',
      addLines: ['Extra line', 'Second extra line'],
      removePatterns: ['privacy'],
    })
    expect(formatChatOverridesForShell(overrides)).toContain("--chat-headline 'Custom headline'")
    expect(formatChatOverridesForShell(overrides)).toContain("--chat-add-line 'Extra line'")
    expect(formatChatOverridesForShell(overrides)).toContain("--chat-remove-pattern 'privacy'")
  })

  it('builds a full dry-run plan with release, deployment, and chat payloads', async () => {
    const dryRunPlan = await buildDryRunPlan({
      repoSlug: 'findmydoc-platform/website',
      releasePlan: {
        nextTag: 'v0.30.0',
        commits: [
          {
            subject: 'feat: cookie consent categories via Payload array (#826)',
            type: 'feat',
            level: 'minor',
          },
        ],
      },
      siteUrl: 'https://findmydoc.eu',
      webhookConfigured: true,
      chatOverrides: {
        addLines: ['Zusatzinfo fuer das Team.'],
      },
    })

    expect(dryRunPlan.release.endpoint).toBe('repos/findmydoc-platform/website/releases')
    expect(dryRunPlan.release.payload.tag_name).toBe('v0.30.0')
    expect(dryRunPlan.deployment.workflowFile).toBe('deploy.yml')
    expect(dryRunPlan.deployment.payload.ref).toBe('main')
    expect(dryRunPlan.chat.webhookConfigured).toBe(true)
    expect(dryRunPlan.chat.payload.text).toContain('Zusatzinfo fuer das Team.')
    expect(dryRunPlan.chat.payload.text).toContain('<https://findmydoc.eu|findmydoc öffnen>')
  })
})
