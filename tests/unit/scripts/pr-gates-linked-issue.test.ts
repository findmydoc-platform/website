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

type LinkedIssueLike = {
  id: string
  number: number
  title: string
  url: string
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

function createLinkedIssue(overrides: Partial<LinkedIssueLike> = {}): LinkedIssueLike {
  return {
    id: 'issue-node-1',
    number: 123,
    title: 'Example issue',
    url: 'https://github.com/findmydoc-platform/website/issues/123',
    ...overrides,
  }
}

function createPullRequestLinkStateResponse({
  number = 42,
  baseRefName = 'main',
  headRefName = 'feature/current',
  defaultBranchName = 'main',
  manualLinkedIssues = [] as LinkedIssueLike[],
  closingIssues = [] as LinkedIssueLike[],
} = {}) {
  return {
    repository: {
      defaultBranchRef: {
        name: defaultBranchName,
      },
      pullRequest: {
        number,
        baseRefName,
        headRefName,
        manualLinkedIssues: {
          nodes: manualLinkedIssues,
        },
        closingIssues: {
          nodes: closingIssues,
        },
      },
    },
  }
}

function createOpenPullRequestsByHeadResponse(numbers: number[]) {
  return {
    repository: {
      pullRequests: {
        nodes: numbers.map((number) => ({ number })),
      },
    },
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
      graphql: vi
        .fn()
        .mockResolvedValueOnce(
          createPullRequestLinkStateResponse({
            baseRefName: 'feature/quality-gates-hardening',
          }),
        )
        .mockResolvedValueOnce(createOpenPullRequestsByHeadResponse([])),
    }
    const context = createContext(createPullRequest({ body: 'Closes #123' }))

    const result = await evaluateLinkedIssueGate({ github, context })

    expect(result.shouldSkip).toBe(false)
    expect(result.shouldFail).toBe(true)
    expect(result.shouldPostComment).toBe(true)
    expect(result.failureComment).toContain('connected to at least one GitHub Issue')
    expect(result.failureComment).toContain('Bug Report')
    expect(result.failureComment).toContain('Feature')
    expect(result.failureComment).toContain('stacked pull requests')
    expect(result.linkedIssues).toEqual([])
    expect(github.graphql).toHaveBeenNthCalledWith(1, expect.stringContaining('userLinkedOnly: true'), {
      owner: 'findmydoc-platform',
      repo: 'website',
      number: 42,
    })
    expect(github.graphql).toHaveBeenNthCalledWith(2, expect.stringContaining('headRefName'), {
      owner: 'findmydoc-platform',
      repo: 'website',
      headRefName: 'feature/quality-gates-hardening',
    })
  })

  it('fails when a non-bot pull request has no linked issue context', async () => {
    const github = {
      graphql: vi.fn().mockResolvedValue(
        createPullRequestLinkStateResponse({
          closingIssues: [],
          manualLinkedIssues: [],
        }),
      ),
    }
    const context = createContext(createPullRequest({ body: 'No issue reference in the body' }))

    const result = await evaluateLinkedIssueGate({ github, context })

    expect(result.shouldSkip).toBe(false)
    expect(result.shouldFail).toBe(true)
    expect(result.shouldPostComment).toBe(true)
    expect(result.linkedIssues).toEqual([])
    expect(result.failureComment).toContain('connected to at least one GitHub Issue')
    expect(result.failureComment).toContain('Bug Report')
    expect(result.failureComment).toContain('Feature')
  })

  it('passes when a default-branch pull request has a closing issue reference', async () => {
    const github = {
      graphql: vi.fn().mockResolvedValue(
        createPullRequestLinkStateResponse({
          closingIssues: [createLinkedIssue()],
        }),
      ),
    }
    const context = createContext(createPullRequest({ body: 'Closes #123' }))

    const result = await evaluateLinkedIssueGate({ github, context })

    expect(result.shouldSkip).toBe(false)
    expect(result.shouldFail).toBe(false)
    expect(result.shouldPostComment).toBe(false)
    expect(result.linkedIssues).toHaveLength(1)
    expect(result.failureComment).toBe('')
  })

  it('passes when a linked issue is manually added in Development without a body reference', async () => {
    const github = {
      graphql: vi.fn().mockResolvedValue(
        createPullRequestLinkStateResponse({
          baseRefName: 'feature/current',
          manualLinkedIssues: [createLinkedIssue()],
        }),
      ),
    }
    const context = createContext(createPullRequest({ body: 'No issue reference in the body' }))

    const result = await evaluateLinkedIssueGate({ github, context })

    expect(result.shouldSkip).toBe(false)
    expect(result.shouldFail).toBe(false)
    expect(result.shouldPostComment).toBe(false)
    expect(result.linkedIssues).toHaveLength(1)
    expect(result.failureComment).toBe('')
  })

  it('passes when a stacked pull request inherits the linked issue from its base pull request', async () => {
    const github = {
      graphql: vi
        .fn()
        .mockResolvedValueOnce(
          createPullRequestLinkStateResponse({
            baseRefName: 'feature/quality-gates-hardening',
            closingIssues: [],
            manualLinkedIssues: [],
          }),
        )
        .mockResolvedValueOnce(createOpenPullRequestsByHeadResponse([908]))
        .mockResolvedValueOnce(
          createPullRequestLinkStateResponse({
            number: 908,
            baseRefName: 'main',
            headRefName: 'feature/quality-gates-hardening',
            closingIssues: [createLinkedIssue({ number: 907 })],
          }),
        ),
    }
    const context = createContext(createPullRequest({ body: 'Refs #907' }))

    const result = await evaluateLinkedIssueGate({ github, context })

    expect(result.shouldSkip).toBe(false)
    expect(result.shouldFail).toBe(false)
    expect(result.shouldPostComment).toBe(false)
    expect(result.linkedIssues).toEqual([
      expect.objectContaining({
        number: 907,
      }),
    ])
  })

  it('builds a stable sticky comment header', () => {
    expect(STICKY_COMMENT_HEADER).toBe('pr-linked-issue-lint-error')
    expect(buildMissingLinkedIssueComment()).toContain('Development')
    expect(buildMissingLinkedIssueComment()).toContain('stacked pull requests')
  })
})
