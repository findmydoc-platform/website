import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  assessContextualReleaseFromReferences,
  buildDryRunPlan,
  buildStakeholderAnnouncementSource,
  buildStakeholderAnnouncementSourceFromCommits,
  buildWorkflowDispatchPayload,
  fetchAssociatedPullRequestIssueReferencesFromCommits,
  formatReleasePlanSummary,
  formatChatOverridesForShell,
  GOOGLE_CHAT_SECRET_NAME,
  parseChatMessageOverrides,
  PRODUCTION_DEPLOY_WORKFLOW_FILE,
  repositorySecretExists,
  renderStakeholderAnnouncementSource,
  renderUsedReleaseItems,
  sendGoogleChatMessage,
} from '../../../.codex/skills/gh-release-publish/scripts/lib.mjs'

type TestIssueReference = {
  number: number
  title: string
  body: string
  url?: string
}

type TestPullRequestReference = {
  number: number
  title: string
  body: string
  url?: string
  issues: TestIssueReference[]
}

const RELEASE_NOTES = `## ✨ New Features & Capabilities
* fix: harden public content routes for mobile by @SebastianSchuetze in https://github.com/findmydoc-platform/website/pull/975
* test: complete final public mobile regression sweep by @SebastianSchuetze in https://github.com/findmydoc-platform/website/pull/976
* fix: harden public auth routes for mobile by @SebastianSchuetze in https://github.com/findmydoc-platform/website/pull/966
* docs: update release playbook by @SebastianSchuetze in https://github.com/findmydoc-platform/website/pull/977
`

const MANAGEMENT_REFERENCES: TestPullRequestReference[] = [
  {
    number: 975,
    title: 'fix: harden public content routes for mobile',
    body: `Improves reading, media fallback behavior, and navigation stability on the public content and CMS routes across the supported mobile viewport matrix.

## What changed
- tighten mobile spacing and hierarchy on /posts, /posts/[slug], and CMS-driven pages
- add a reusable FallbackImage atom so broken blog or author media degrades to stable placeholders instead of broken images
- extend Storybook coverage with full viewport-matrix stories for the touched content templates

## Validation
- pnpm format
- Playwright runtime QA on public content routes
`,
    url: 'https://github.com/findmydoc-platform/website/pull/975',
    issues: [
      {
        number: 963,
        title: 'Feature: public content routes mobile pass',
        body: `Problem Statement
The public content and CMS-driven routes still need dedicated mobile work because text-heavy layouts, media blocks, and real CMS content can create hierarchy, spacing, and overflow failures.

Intended Outcome
The public content routes remain readable, touch-friendly, and visually stable across the supported mobile viewport range.

Quality Criteria
- Validates long-content and media-heavy route states with real runtime evidence.
`,
        url: 'https://github.com/findmydoc-platform/website/issues/963',
      },
    ],
  },
  {
    number: 976,
    title: 'test: complete final public mobile regression sweep',
    body: `Completes the refreshed final public mobile regression sweep so the remaining public UI evidence and narrow clinic-detail readability fixes stay merge-ready.

## What changed
- refresh the combined Playwright public-route sweep on the latest stacked phase head
- improve clinic-detail mobile readability by scaling the treatments heading down on narrow viewports
- complete three refreshed mobile reviewer passes for the final public sweep

## Validation
- Playwright runtime QA
- mobile_ui_reviewer refreshed final pass completed
`,
    url: 'https://github.com/findmydoc-platform/website/pull/976',
    issues: [
      {
        number: 964,
        title: 'Feature: final public mobile regression sweep',
        body: `Problem Statement
Even after the route families are addressed individually, the public UI can still carry cross-phase mobile regressions.

Intended Outcome
The complete public UI has a final mobile regression pass with documented evidence and no remaining high-severity mobile findings tied to the rollout.

Acceptance Criteria
- The already touched public route families are rechecked as one combined regression sweep.
`,
        url: 'https://github.com/findmydoc-platform/website/issues/964',
      },
    ],
  },
  {
    number: 966,
    title: 'fix: harden public auth routes for mobile',
    body: `Improves the mobile reliability of public auth routes across the supported narrow viewport matrix.

## What changed
- reduce friction on login, invite completion, password reset, and registration flows on small screens
- keep submission and feedback states stable on mobile

## Validation
- Playwright runtime QA on public auth routes
`,
    url: 'https://github.com/findmydoc-platform/website/pull/966',
    issues: [
      {
        number: 961,
        title: 'Feature: public auth routes mobile pass',
        body: `Problem Statement
Public auth routes can still fail on small screens because key actions, spacing, and input states do not always stay coherent.

Intended Outcome
Login, registration, invite, and password reset flows remain readable and easy to complete on mobile.
`,
        url: 'https://github.com/findmydoc-platform/website/issues/961',
      },
    ],
  },
  {
    number: 977,
    title: 'docs: update release playbook',
    body: `## What changed
- refresh release checklist wording
- update output/playwright/mobile-pass.png references

## Validation
- pnpm format
`,
    url: 'https://github.com/findmydoc-platform/website/pull/977',
    issues: [],
  },
]

describe('gh-release-publish announcement source flow', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('resolves PRs from commit SHAs without relying on subject parsing', async () => {
    const primaryReference = MANAGEMENT_REFERENCES[0]!
    const primaryIssue = primaryReference.issues[0]!
    const runJsonImpl = vi.fn((command: string, args: unknown[] = []) => {
      const shaField = args.find((argument: unknown) => String(argument).startsWith('sha='))
      const sha = shaField ? String(shaField).slice(4) : null

      if (sha === 'sha-1') {
        return {
          data: {
            repository: {
              object: {
                associatedPullRequests: {
                  nodes: [
                    {
                      number: 975,
                      title: 'fix: harden public content routes for mobile',
                      body: primaryReference.body,
                      url: primaryReference.url,
                      closingIssuesReferences: {
                        nodes: [
                          {
                            number: 963,
                            title: 'Feature: public content routes mobile pass',
                            body: primaryIssue.body,
                            url: primaryIssue.url,
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            },
          },
        }
      }

      if (sha === 'sha-2') {
        return {
          data: {
            repository: {
              object: {
                associatedPullRequests: {
                  nodes: [
                    {
                      number: 975,
                      title: 'fix: harden public content routes for mobile',
                      body: primaryReference.body,
                      url: primaryReference.url,
                      closingIssuesReferences: {
                        nodes: [],
                      },
                    },
                  ],
                },
              },
            },
          },
        }
      }

      throw new Error(`Unexpected gh api request: ${command} ${args.join(' ')}`)
    })

    const references = await fetchAssociatedPullRequestIssueReferencesFromCommits({
      repoSlug: 'findmydoc-platform/website',
      commits: [
        {
          sha: 'sha-1',
          subject: 'fix: improve mobile public routes',
          type: 'fix',
          level: 'patch',
        },
        {
          sha: 'sha-2',
          subject: 'fix: keep mobile public routes stable',
          type: 'fix',
          level: 'patch',
        },
      ],
      runJsonImpl,
    })

    expect(references).toHaveLength(1)
    expect(references[0]!.number).toBe(975)
    expect(references[0]!.issues).toHaveLength(1)
    expect(references[0]!.issues[0]!.number).toBe(963)
  })

  it('collects drafting source from PR and linked issue content and filters maintenance-only PRs', async () => {
    const source = await buildStakeholderAnnouncementSource({
      releaseTag: 'v0.30.0',
      releaseUrl: 'https://github.com/findmydoc-platform/website/releases/tag/v0.30.0',
      siteUrl: 'https://findmydoc.eu',
      releaseNotes: RELEASE_NOTES,
      references: MANAGEMENT_REFERENCES,
    })

    expect(source.releaseTag).toBe('v0.30.0')
    expect(source.draftingGuidance.style).toBe('management-summary')
    expect(source.pullRequests).toHaveLength(3)
    expect(source.pullRequests.map((pullRequest: { number: number }) => pullRequest.number)).toEqual([975, 976, 966])
    expect(source.pullRequests[0]!.title).toBe('harden public content routes for mobile')
    expect(source.pullRequests[0]!.what_changed).toContain(
      'tighten mobile spacing and hierarchy on /posts, /posts/[slug], and CMS-driven pages',
    )
    expect(source.pullRequests[0]!.linked_issues[0]!.problem_statement).toContain(
      'The public content and CMS-driven routes still need dedicated mobile work because text-heavy layouts, media blocks, and real CMS content can create hierarchy, spacing, and overflow failures.',
    )
    expect(source.pullRequests[0]!.linked_issues[0]!.intended_outcome).toContain(
      'The public content routes remain readable, touch-friendly, and visually stable across the supported mobile viewport range.',
    )
    expect(source.pullRequests[0]!.quality_and_validation).toContain('End-to-End-Tests')
    expect(source.pullRequests[0]!.quality_and_validation).not.toContain('pnpm format')

    const rendered = renderStakeholderAnnouncementSource(source)
    expect(rendered).toContain('Stakeholder announcement source:')
    expect(rendered).toContain('PR #975: harden public content routes for mobile')
    expect(rendered).toContain('Linked issue #963: Feature: public content routes mobile pass')
    expect(rendered).not.toContain('pnpm format')
    expect(rendered).not.toContain('output/playwright/mobile-pass.png')
  })

  it('renders the used PR and issue list in PR-first order with URLs', async () => {
    const source = await buildStakeholderAnnouncementSource({
      releaseTag: 'v0.30.0',
      releaseUrl: 'https://github.com/findmydoc-platform/website/releases/tag/v0.30.0',
      siteUrl: 'https://findmydoc.eu',
      releaseNotes: RELEASE_NOTES,
      references: MANAGEMENT_REFERENCES,
    })

    const rendered = renderUsedReleaseItems(source)
    expect(rendered).toContain('Verwendete PRs und Issues:')
    expect(rendered).toContain(
      '- PR #975 (https://github.com/findmydoc-platform/website/pull/975) (fix: harden public content routes for mobile) -> Issue #963 (https://github.com/findmydoc-platform/website/issues/963) (Feature: public content routes mobile pass)',
    )
    expect(rendered).not.toContain('PR #977')
  })

  it('keeps the technical bump and reports a separate contextual semantic assessment', () => {
    const technicalPlan = {
      lastTag: 'v0.31.0',
      nextTag: 'v0.31.1',
      bump: 'patch',
      bumpReason: 'Only patch-level changes detected.',
      commitCount: 14,
      counts: {
        major: 0,
        minor: 0,
        patch: 14,
        conventional: 14,
        nonConventional: 0,
        linkedFeatureSignals: 0,
      },
      commits: [
        {
          sha: 'f2af3d1',
          subject: 'fix: harden public content routes for mobile (#975)',
          conventional: true,
          level: 'patch',
        },
      ],
    }

    const assessment = assessContextualReleaseFromReferences(technicalPlan, MANAGEMENT_REFERENCES)
    const rendered = formatReleasePlanSummary({
      ...technicalPlan,
      counts: {
        ...technicalPlan.counts,
        linkedFeatureSignals: assessment.linkedFeatureSignals,
      },
      contextualAssessment: assessment.contextualAssessment,
    })

    expect(assessment.technicalAssessment.bump).toBe('patch')
    expect(assessment.contextualAssessment.bump).toBe('minor')
    expect(assessment.contextualAssessment.nextTag).toBe('v0.32.0')
    expect(rendered).toContain('Technical next tag: v0.31.1')
    expect(rendered).toContain('Technical bump: patch')
    expect(rendered).toContain('Contextual next tag: v0.32.0')
    expect(rendered).toContain('Contextual bump: minor')
  })

  it('can suggest a contextual major release without overriding the technical bump', () => {
    const technicalPlan = {
      lastTag: 'v0.31.0',
      nextTag: 'v0.31.1',
      bump: 'patch',
      bumpReason: 'Only patch-level changes detected.',
      commitCount: 1,
      counts: {
        major: 0,
        minor: 0,
        patch: 1,
        conventional: 1,
        nonConventional: 0,
        linkedFeatureSignals: 0,
      },
      commits: [
        {
          sha: 'abcdef1',
          subject: 'fix: adjust public auth rollout (#999)',
          conventional: true,
          level: 'patch',
        },
      ],
    }

    const assessment = assessContextualReleaseFromReferences(technicalPlan, [
      {
        number: 999,
        title: 'fix: adjust public auth rollout',
        body: 'Migration required for previously issued public auth links.',
        issues: [
          {
            number: 998,
            title: 'Breaking: previously issued invite links no longer stay compatible',
            body: '',
          },
        ],
      },
    ])

    expect(assessment.technicalAssessment.bump).toBe('patch')
    expect(assessment.contextualAssessment.bump).toBe('major')
    expect(assessment.contextualAssessment.nextTag).toBe('v1.0.0')
  })

  it('falls back cleanly when only weak linked issue text is available', async () => {
    const source = await buildStakeholderAnnouncementSourceFromCommits({
      releaseTag: 'v0.30.3',
      releaseUrl: 'https://github.com/findmydoc-platform/website/releases/tag/v0.30.3',
      siteUrl: 'https://findmydoc.eu',
      commits: [
        {
          subject: 'fix: harden public auth routes for mobile (#966)',
          type: 'fix',
          level: 'patch',
        },
      ],
      references: [
        {
          number: 966,
          title: 'fix: harden public auth routes for mobile',
          body: '',
          issues: [
            {
              number: 961,
              title: 'Feature: public auth routes mobile pass',
              body: '',
            },
          ],
        },
      ],
    })

    expect(source.pullRequests[0]!.title).toBe('harden public auth routes for mobile')
    expect(source.pullRequests[0]!.what_changed).toContain('harden public auth routes for mobile')
    expect(source.pullRequests[0]!.linked_issues[0]!.title).toBe('Feature: public auth routes mobile pass')
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

  it('builds a dry-run plan with filtered drafting context instead of a generated final message', async () => {
    const dryRunPlan = await buildDryRunPlan({
      repoSlug: 'findmydoc-platform/website',
      releasePlan: {
        nextTag: 'v0.30.0',
        commits: [
          {
            subject: 'fix: harden public content routes for mobile (#975)',
            type: 'fix',
            level: 'patch',
          },
          {
            subject: 'docs: update release playbook (#977)',
            type: 'docs',
            level: 'patch',
          },
        ],
      },
      references: MANAGEMENT_REFERENCES,
      siteUrl: 'https://findmydoc.eu',
      googleChatSecretConfigured: true,
    })

    expect(dryRunPlan.release.endpoint).toBe('repos/findmydoc-platform/website/releases')
    expect(dryRunPlan.release.payload.tag_name).toBe('v0.30.0')
    expect(dryRunPlan.deployment.workflowFile).toBe(PRODUCTION_DEPLOY_WORKFLOW_FILE)
    expect(dryRunPlan.deployment.payload.ref).toBe('main')
    expect(dryRunPlan.chat.repositorySecretConfigured).toBe(true)
    expect(dryRunPlan.chat.repositorySecretName).toBe(GOOGLE_CHAT_SECRET_NAME)
    expect(dryRunPlan.chat.workflowFile).toBe('send-release-google-chat.yml')
    expect(dryRunPlan.chat.endpoint).toBe(
      'repos/findmydoc-platform/website/actions/workflows/send-release-google-chat.yml/dispatches',
    )
    expect(dryRunPlan.chat.payloadTemplate).toEqual(
      buildWorkflowDispatchPayload({
        ref: 'main',
        inputs: {
          message_text: '<final German Google Chat message from Codex>',
          release_tag: 'v0.30.0',
        },
      }),
    )
    expect(dryRunPlan.chat.draftingRequired).toBe(true)
    expect(dryRunPlan.chat).not.toHaveProperty('payload')
    expect(dryRunPlan.chat.source.pullRequests.map((pullRequest: { number: number }) => pullRequest.number)).toEqual([
      975, 976, 966,
    ])
    expect(dryRunPlan.chat.source.pullRequests[0]!.linked_issues[0]!.problem_statement).toContain(
      'The public content and CMS-driven routes still need dedicated mobile work because text-heavy layouts, media blocks, and real CMS content can create hierarchy, spacing, and overflow failures.',
    )
  })

  it('detects the configured Google Chat repository secret through gh', () => {
    const present = repositorySecretExists({
      repoSlug: 'findmydoc-platform/website',
      secretName: GOOGLE_CHAT_SECRET_NAME,
      runJsonImpl: vi.fn(() => [{ name: 'CRON_SECRET' }, { name: GOOGLE_CHAT_SECRET_NAME }]),
    })
    const missing = repositorySecretExists({
      repoSlug: 'findmydoc-platform/website',
      secretName: GOOGLE_CHAT_SECRET_NAME,
      runJsonImpl: vi.fn(() => [{ name: 'CRON_SECRET' }]),
    })

    expect(present).toBe(true)
    expect(missing).toBe(false)
  })

  it('sends explicit multi-line Google Chat text without generating content on its own', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
    }))
    vi.stubGlobal('fetch', fetchMock)

    const message = `*findmydoc v0.30.0 ist live*
Dieses Release verbessert vor allem die mobile Nutzbarkeit.
- Wichtige Änderungen:
- Inhaltsseiten wurden lesbarer gemacht.
<https://github.com/findmydoc-platform/website/releases/tag/v0.30.0|Release Notes>`

    const result = await sendGoogleChatMessage({
      text: message,
      webhookUrl: 'https://chat.example.invalid/webhook',
    })

    expect(result.responseStatus).toBe(200)
    expect(result.payload.text).toBe(message)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const firstCall = fetchMock.mock.calls[0] as [RequestInfo | URL, RequestInit | undefined] | undefined
    expect(firstCall?.[1]?.body).toBe(JSON.stringify({ text: message }))
  })
})
