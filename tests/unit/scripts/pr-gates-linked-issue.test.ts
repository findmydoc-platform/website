import { describe, expect, it, vi } from 'vitest'

import {
  buildMissingLinkedIssueComment,
  evaluateLinkedIssueGate,
  isBotAuthor,
  STICKY_COMMENT_HEADER,
} from '../../../.github/scripts/pr-gates-linked-issue.cjs'

type PullRequestLike = {
  number: number
  body?: string | null
  url: string
  user?: {
    login: string
    type: 'Bot' | 'User' | 'Organization'
  } | null
}

function createPullRequest(overrides: Partial<PullRequestLike> = {}): PullRequestLike {
  return {
    number: 42,
    body: 'Default body',
    url: 'https://github.com/findmydoc-platform/website/pull/42',
    user: {
      login: 'jane-doe',
      type: 'User',
    },
    ...overrides,
  }
}

function createContext(pullRequest: PullRequestLike) {
  return {
    repo: {
      owner: 'findmydoc-platform',
      repo: 'website',
    },
    payload: {
      pull_request: pullRequest,
    },
  }
}

describe('pr gates linked issue helper', () => {
  it('detects bot authors', () => {
    expect(isBotAuthor(createPullRequest({ user: { login: 'dependabot[bot]', type: 'Bot' } }))).toBe(true)
    expect(isBotAuthor(createPullRequest())).toBe(false)
  })

  it('skips bot-authored pull requests', async () => {
    const github = {
      graphql: vi.fn(),
    }
    const context = createContext(
      createPullRequest({
        body: 'Fixes #123',
        user: { login: 'dependabot[bot]', type: 'Bot' },
      }),
    )

    const result = await evaluateLinkedIssueGate({ github, context })

    expect(result).toEqual({
      shouldSkip: true,
      shouldFail: false,
      shouldPostComment: false,
      failureComment: '',
      linkedIssues: [],
    })
    expect(github.graphql).not.toHaveBeenCalled()
  })

  it('fails when a non-bot pull request only references an issue in the body', async () => {
    const github = {
      graphql: vi.fn().mockResolvedValue({
        repository: {
          pullRequest: {
            manualLinkedIssues: {
              nodes: [],
            },
          },
        },
      }),
    }
    const context = createContext(createPullRequest({ body: 'Closes #123' }))

    const result = await evaluateLinkedIssueGate({ github, context })

    expect(result.shouldSkip).toBe(false)
    expect(result.shouldFail).toBe(true)
    expect(result.shouldPostComment).toBe(true)
    expect(result.failureComment).toContain('Development')
    expect(result.failureComment).toContain('Bug Report')
    expect(result.failureComment).toContain('Feature')
    expect(result.failureComment).toContain('GitHub Issue linked in the `Development` section')
    expect(result.linkedIssues).toEqual([])
    expect(github.graphql).toHaveBeenCalledWith(expect.stringContaining('userLinkedOnly: true'), {
      owner: 'findmydoc-platform',
      repo: 'website',
      number: 42,
    })
  })

  it('fails when a non-bot pull request has no Development-linked issue', async () => {
    const github = {
      graphql: vi.fn().mockResolvedValue({
        repository: {
          pullRequest: {
            manualLinkedIssues: {
              nodes: [],
            },
          },
        },
      }),
    }
    const context = createContext(createPullRequest({ body: 'No issue reference in the body' }))

    const result = await evaluateLinkedIssueGate({ github, context })

    expect(result.shouldSkip).toBe(false)
    expect(result.shouldFail).toBe(true)
    expect(result.shouldPostComment).toBe(true)
    expect(result.linkedIssues).toEqual([])
    expect(result.failureComment).toContain('Development')
    expect(result.failureComment).toContain('Bug Report')
    expect(result.failureComment).toContain('Feature')
  })

  it('passes when a linked issue is manually added in Development without a body reference', async () => {
    const github = {
      graphql: vi.fn().mockResolvedValue({
        repository: {
          pullRequest: {
            manualLinkedIssues: {
              nodes: [
                {
                  id: 'issue-node-1',
                  number: 123,
                  title: 'Example issue',
                  url: 'https://github.com/findmydoc-platform/website/issues/123',
                },
              ],
            },
          },
        },
      }),
    }
    const context = createContext(createPullRequest({ body: 'No issue reference in the body' }))

    const result = await evaluateLinkedIssueGate({ github, context })

    expect(result.shouldSkip).toBe(false)
    expect(result.shouldFail).toBe(false)
    expect(result.shouldPostComment).toBe(false)
    expect(result.linkedIssues).toHaveLength(1)
    expect(result.failureComment).toBe('')
  })

  it('builds a stable sticky comment header', () => {
    expect(STICKY_COMMENT_HEADER).toBe('pr-linked-issue-lint-error')
    expect(buildMissingLinkedIssueComment()).toContain('Development')
  })
})
