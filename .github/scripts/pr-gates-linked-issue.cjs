/**
 * PR Gates linked issue automation.
 *
 * Purpose
 * - Require every non-bot pull request, including AI-assisted PRs created
 *   under a human GitHub account, to reference at least one GitHub Issue in
 *   the PR body or Development section.
 *
 * How it works
 * - Skips pull requests authored by bots.
 * - Uses GitHub GraphQL with `closingIssuesReferences` to read issues that the
 *   PR references.
 * - Requires the PR body to mention one of those linked issues so commit
 *   history alone does not satisfy the gate.
 * - Returns a failure comment that points authors to the Issue templates.
 */

const STICKY_COMMENT_HEADER = 'pr-linked-issue-lint-error'

const ISSUE_TEMPLATE_NAMES = ['Bug Report', 'Feature']

const LINKED_ISSUES_QUERY = `
  query($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        body
        linkedIssues: closingIssuesReferences(first: 10) {
          nodes {
            id
            number
            title
            url
          }
        }
        manualLinkedIssues: closingIssuesReferences(first: 10, userLinkedOnly: true) {
          nodes {
            id
            number
            title
            url
          }
        }
      }
    }
  }
`

function isBotAuthor(pullRequest) {
  return pullRequest?.user?.type === 'Bot'
}

function issueMentionPatterns(issueNumber) {
  const issueRef = String(issueNumber)

  return [
    new RegExp(String.raw`(?:^|[\s(])#${issueRef}\b`, 'i'),
    new RegExp(
      String.raw`(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+(?:[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)?#${issueRef}\b`,
      'i',
    ),
    new RegExp(String.raw`https:\/\/github.com\/[^/\\s]+\/[^/\s]+\/issues\/${issueRef}\b`, 'i'),
  ]
}

function bodyMentionsLinkedIssue(body, linkedIssues) {
  const normalizedBody = String(body ?? '')

  return linkedIssues.some((issue) =>
    issueMentionPatterns(issue.number).some((pattern) => pattern.test(normalizedBody)),
  )
}

function buildMissingLinkedIssueComment() {
  return [
    'This pull request must reference at least one GitHub Issue in the PR body or `Development` section.',
    '',
    `Open or reuse an Issue first. If you need a new one, use the ${ISSUE_TEMPLATE_NAMES.map((name) => `\`${name}\``).join(' or ')} template.`,
    '',
    'AI-assisted and human-authored PRs must link an Issue; only GitHub bot-authored PRs are exempt.',
    'Commit history alone does not count for this check.',
  ].join('\n')
}

async function getLinkedIssues({ github, owner, repo, number }) {
  const { repository } = await github.graphql(LINKED_ISSUES_QUERY, {
    owner,
    repo,
    number,
  })

  return {
    linkedIssues: repository?.pullRequest?.linkedIssues?.nodes ?? [],
    manualLinkedIssues: repository?.pullRequest?.manualLinkedIssues?.nodes ?? [],
  }
}

async function evaluateLinkedIssueGate({ github, context, core = undefined }) {
  const pullRequest = context?.payload?.pull_request

  if (!pullRequest) {
    throw new Error('No pull_request payload available.')
  }

  if (isBotAuthor(pullRequest)) {
    core?.info?.('Pull request author is a bot; skipping linked issue gate.')
    return {
      shouldSkip: true,
      shouldFail: false,
      shouldPostComment: false,
      failureComment: '',
      linkedIssues: [],
    }
  }

  const owner = context.repo.owner
  const repo = context.repo.repo
  const number = pullRequest.number
  const body = pullRequest.body

  const { linkedIssues, manualLinkedIssues } = await getLinkedIssues({ github, owner, repo, number })
  const bodyMentionsIssue = bodyMentionsLinkedIssue(body, linkedIssues)
  const shouldFail = linkedIssues.length === 0 || (!bodyMentionsIssue && manualLinkedIssues.length === 0)

  if (shouldFail) {
    if (linkedIssues.length === 0) {
      core?.info?.('No linked issue found for this pull request.')
    } else if (manualLinkedIssues.length > 0) {
      core?.info?.('Linked issue was manually added in Development; body reference is not required.')
    } else {
      core?.info?.('Linked issue found, but the PR body does not reference it.')
    }
  } else {
    const [firstLinkedIssue] = linkedIssues
    if (bodyMentionsIssue) {
      core?.info?.(`Linked issue found in PR body/Development: #${firstLinkedIssue.number} ${firstLinkedIssue.title}`)
    } else {
      core?.info?.(`Linked issue found in Development: #${firstLinkedIssue.number} ${firstLinkedIssue.title}`)
    }
  }

  return {
    shouldSkip: false,
    shouldFail,
    shouldPostComment: shouldFail,
    failureComment: shouldFail ? buildMissingLinkedIssueComment() : '',
    linkedIssues;
  }
}

module.exports = {
  STICKY_COMMENT_HEADER,
  buildMissingLinkedIssueComment,
  bodyMentionsLinkedIssue,
  evaluateLinkedIssueGate,
  getLinkedIssues,
  issueMentionPatterns,
  isBotAuthor,
}
