const STICKY_COMMENT_HEADER = 'pr-linked-issue-lint-error'

const ISSUE_TEMPLATE_NAMES = ['Bug Report', 'Feature']

const PULL_REQUEST_LINK_STATE_QUERY = `
  query($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      defaultBranchRef {
        name
      }
      pullRequest(number: $number) {
        number
        baseRefName
        baseRefOid
        headRefName
        headRefOid
        isCrossRepository
        headRepositoryOwner {
          login
        }
        manualLinkedIssues: closingIssuesReferences(first: 10, userLinkedOnly: true) {
          nodes {
            id
            number
            title
            url
          }
        }
        closingIssues: closingIssuesReferences(first: 10) {
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

const OPEN_PULL_REQUESTS_BY_HEAD_QUERY = `
  query($owner: String!, $repo: String!, $headRefName: String!) {
    repository(owner: $owner, name: $repo) {
      pullRequests(
        first: 10
        states: OPEN
        headRefName: $headRefName
        orderBy: { field: CREATED_AT, direction: DESC }
      ) {
        nodes {
          number
          baseRefName
          baseRefOid
          headRefName
          headRefOid
          isCrossRepository
          headRepositoryOwner {
            login
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
    'This pull request must be connected to at least one GitHub Issue.',
    '',
    'Accepted links:',
    '- a manual link in the `Development` section',
    '- a closing reference on a pull request that targets the default branch, such as `Closes #123`',
    '- for stacked pull requests, an inherited issue link from the open base pull request',
    '',
    `Open or reuse an Issue first. If you need a new one, use the ${ISSUE_TEMPLATE_NAMES.map((name) => `\`${name}\``).join(' or ')} template.`,
    '',
    'AI-assisted and human-authored PRs must link an Issue; only GitHub bot-authored PRs are exempt.',
  ].join('\n')
}

function normalizeIssueNodes(connection) {
  return connection?.nodes ?? []
}

function isMatchingBasePullRequestCandidate({ currentPullRequest, candidatePullRequest, owner }) {
  if (!currentPullRequest || !candidatePullRequest) {
    return false
  }

  if (candidatePullRequest.number === currentPullRequest.number) {
    return false
  }

  if (candidatePullRequest.headRefName !== currentPullRequest.baseRefName) {
    return false
  }

  if (candidatePullRequest.headRefOid !== currentPullRequest.baseRefOid) {
    return false
  }

  if (candidatePullRequest.isCrossRepository) {
    return false
  }

  if (candidatePullRequest.headRepositoryOwner?.login !== owner) {
    return false
  }

  return true
}

async function getPullRequestLinkState({ github, owner, repo, number }) {
  const { repository } = await github.graphql(PULL_REQUEST_LINK_STATE_QUERY, {
    owner,
    repo,
    number,
  })

  return {
    defaultBranchName: repository?.defaultBranchRef?.name ?? null,
    pullRequest: repository?.pullRequest ?? null,
  }
}

async function getOpenPullRequestNumbersByHeadRef({ github, owner, repo, headRefName }) {
  const { repository } = await github.graphql(OPEN_PULL_REQUESTS_BY_HEAD_QUERY, {
    owner,
    repo,
    headRefName,
  })

  return repository?.pullRequests?.nodes ?? []
}

async function getLinkedIssueResolution({ github, owner, repo, number, visited = new Set() }) {
  if (visited.has(number)) {
    return {
      linkedIssues: [],
      source: 'none',
      resolvedInPullRequestNumber: number,
    }
  }

  visited.add(number)

  const { defaultBranchName, pullRequest } = await getPullRequestLinkState({
    github,
    owner,
    repo,
    number,
  })

  const manualLinkedIssues = normalizeIssueNodes(pullRequest?.manualLinkedIssues)
  if (manualLinkedIssues.length > 0) {
    return {
      linkedIssues: manualLinkedIssues,
      source: 'development',
      resolvedInPullRequestNumber: number,
    }
  }

  const closingIssues = normalizeIssueNodes(pullRequest?.closingIssues)
  if (closingIssues.length > 0 && pullRequest?.baseRefName === defaultBranchName) {
    return {
      linkedIssues: closingIssues,
      source: 'default-branch-closing-reference',
      resolvedInPullRequestNumber: number,
    }
  }

  if (pullRequest?.baseRefName && pullRequest.baseRefName !== defaultBranchName) {
    const basePullRequests = await getOpenPullRequestNumbersByHeadRef({
      github,
      owner,
      repo,
      headRefName: pullRequest.baseRefName,
    })

    for (const basePullRequest of basePullRequests) {
      if (
        !isMatchingBasePullRequestCandidate({
          currentPullRequest: pullRequest,
          candidatePullRequest: basePullRequest,
          owner,
        })
      ) {
        continue
      }

      const inheritedResolution = await getLinkedIssueResolution({
        github,
        owner,
        repo,
        number: basePullRequest.number,
        visited,
      })

      if (inheritedResolution.linkedIssues.length > 0) {
        return {
          linkedIssues: inheritedResolution.linkedIssues,
          source: 'stacked-base-pull-request',
          resolvedInPullRequestNumber: inheritedResolution.resolvedInPullRequestNumber,
        }
      }
    }
  }

  return {
    linkedIssues: [],
    source: 'none',
    resolvedInPullRequestNumber: number,
  }
}

async function getLinkedIssues({ github, owner, repo, number }) {
  const resolution = await getLinkedIssueResolution({
    github,
    owner,
    repo,
    number,
  })

  return resolution.linkedIssues
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

  const resolution = await getLinkedIssueResolution({ github, owner, repo, number })
  const linkedIssues = resolution.linkedIssues
  const shouldFail = linkedIssues.length === 0

  if (shouldFail) {
    core?.info?.('No linked issue context found for this pull request.')
  } else {
    const [firstLinkedIssue] = linkedIssues
    if (resolution.source === 'stacked-base-pull-request') {
      core?.info?.(
        `Linked issue inherited from stacked base pull request #${resolution.resolvedInPullRequestNumber}: #${firstLinkedIssue.number} ${firstLinkedIssue.title}`,
      )
    } else if (resolution.source === 'default-branch-closing-reference') {
      core?.info?.(
        `Linked issue found through a default-branch closing reference: #${firstLinkedIssue.number} ${firstLinkedIssue.title}`,
      )
    } else {
      core?.info?.(`Linked issue found in Development: #${firstLinkedIssue.number} ${firstLinkedIssue.title}`)
    }
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
