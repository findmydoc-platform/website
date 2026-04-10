import { describe, expect, it } from 'vitest'

import {
  filterEligibleClosedIssuesForRelease,
  isEligibleClosedIssueForRelease,
} from '../../../.github/scripts/post-release-issue-commenter.cjs'

type GitHubIssueLike = {
  number: number
  title: string
  closed_at: string
  state_reason?: string | null
  pull_request?: { url: string }
}

function createIssue(overrides: Partial<GitHubIssueLike> = {}): GitHubIssueLike {
  return {
    number: 42,
    title: 'Example issue',
    closed_at: '2026-04-05T12:00:00.000Z',
    state_reason: 'completed',
    ...overrides,
  }
}

describe('post-release issue commenter', () => {
  const previousReleaseDate = new Date('2026-04-01T00:00:00.000Z')
  const releaseDate = new Date('2026-04-10T00:00:00.000Z')

  it('accepts completed issues within the release window', () => {
    const issue = createIssue()

    expect(
      isEligibleClosedIssueForRelease({
        issue,
        previousReleaseDate,
        releaseDate,
      }),
    ).toBe(true)
  })

  it.each([
    ['not_planned', false],
    ['duplicate', false],
    [undefined, false],
  ])('rejects issues with state_reason %s', (stateReason, expected) => {
    const issue = createIssue({ state_reason: stateReason })

    expect(
      isEligibleClosedIssueForRelease({
        issue,
        previousReleaseDate,
        releaseDate,
      }),
    ).toBe(expected)
  })

  it('rejects pull requests even if they were completed', () => {
    const issue = createIssue({
      pull_request: { url: 'https://example.com/pull/1' },
    })

    expect(
      isEligibleClosedIssueForRelease({
        issue,
        previousReleaseDate,
        releaseDate,
      }),
    ).toBe(false)
  })

  it('rejects issues closed outside the release window', () => {
    const issue = createIssue({ closed_at: '2026-04-11T00:00:00.000Z' })

    expect(
      isEligibleClosedIssueForRelease({
        issue,
        previousReleaseDate,
        releaseDate,
      }),
    ).toBe(false)
  })

  it('filters only eligible issues from the release batch', () => {
    const issues: GitHubIssueLike[] = [
      createIssue({ number: 1 }),
      createIssue({ number: 2, state_reason: 'not_planned' }),
      createIssue({ number: 3, pull_request: { url: 'https://example.com/pull/3' } }),
      createIssue({ number: 4, closed_at: '2026-04-11T00:00:00.000Z' }),
    ]

    const eligibleIssues: GitHubIssueLike[] = filterEligibleClosedIssuesForRelease(issues, {
      previousReleaseDate,
      releaseDate,
    })

    expect(eligibleIssues.map((issue) => issue.number)).toEqual([1])
  })
})
