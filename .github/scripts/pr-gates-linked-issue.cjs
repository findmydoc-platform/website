/**
 * PR Gates linked issue automation.
 *
 * Purpose
 * - Require every non-bot pull request, including AI-assisted PRs created
 *   under a human GitHub account, to have at least one manually linked GitHub
 *   Issue in the PR's Development section.
 *
 * How it works
 * - Skips pull requests authored by bots.
 * - Uses GitHub GraphQL with `closingIssuesReferences(userLinkedOnly: true)` to
 *   read the manually linked issues only.
 * - Returns a failure comment that points authors to the Issue templates.
 */

const STICKY_COMMENT_HEADER = 'pr-linked-issue-lint-error'

const ISSUE_TEMPLATE_NAMES = ['Bug Report', 'Feature']

const LINKED_ISSUES_QUERY = `
  query($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        closingIssuesReferences(first: 1, userLinkedOnly: true) {
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

function buildMissingLinkedIssueComment() {
  return [
    'This pull request must be linked to at least one GitHub Issue in the `Development` section.',
    '',
    `Open or reuse an Issue first. If you need a new one, use the ${ISSUE_TEMPLATE_NAMES.map((name) => `\`${name}\``).join(' or ')} template.`,
    '',
    'AI-assisted and human-authored PRs must link an Issue; only GitHub bot-authored PRs are exempt.',
    'PR body text and commit history do not count for this check.',
  ].join('\n')
}

async function getLinkedIssues({ github, owner, repo, number }) {
  const { repository } = await github.graphql(LINKED_ISSUES_QUERY, {
    owner,
    repo,
    number,
  })

  return repository?.pullRequest?.closingIssuesReferences?.nodes ?? []
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

  const linkedIssues = await getLinkedIssues({ github, owner, repo, number })
  const shouldFail = linkedIssues.length === 0

  if (shouldFail) {
    core?.info?.('No manually linked issue found for this pull request.')
  } else {
    const [firstLinkedIssue] = linkedIssues
    core?.info?.(`Linked issue found: #${firstLinkedIssue.number} ${firstLinkedIssue.title}`)
  }

  return {
    shouldSkip: false,
    shouldFail,
    shouldPostComment: shouldFail,
    failureComment: shouldFail ? buildMissingLinkedIssueComment() : '',
    linkedIssues,
  }
}

module.exports = {
  STICKY_COMMENT_HEADER,
  buildMissingLinkedIssueComment,
  evaluateLinkedIssueGate,
  getLinkedIssues,
  isBotAuthor,
}
