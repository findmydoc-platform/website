const MAX_PAGES = 20
const PAGE_SIZE = 100

const normalizeAnchorPath = (anchor) => {
  if (!anchor) {
    return ''
  }

  if (typeof anchor === 'string') {
    return anchor
  }

  return String(anchor.filename ?? '')
}

const createManagedMarker = ({ scopeName, key }) => `<!-- review-comment-sync:${scopeName}:${key} -->`

function isManagedBotComment({ comment, marker }) {
  const body = String(comment.body ?? '')
  const login = String(comment.user?.login ?? '')
  const userType = String(comment.user?.type ?? '')

  return body.includes(marker) && login === 'github-actions[bot]' && userType === 'Bot'
}

async function listPullReviewComments({ github, owner, repo, pull_number }) {
  const comments = []

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { data } = await github.rest.pulls.listReviewComments({
      owner,
      repo,
      pull_number,
      per_page: PAGE_SIZE,
      page,
    })

    if (!data?.length) {
      break
    }

    comments.push(...data)

    if (data.length < PAGE_SIZE) {
      break
    }
  }

  return comments
}

async function listPullIssueComments({ github, owner, repo, issue_number }) {
  const comments = []

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { data } = await github.rest.issues.listComments({
      owner,
      repo,
      issue_number,
      per_page: PAGE_SIZE,
      page,
    })

    if (!data?.length) {
      break
    }

    comments.push(...data)

    if (data.length < PAGE_SIZE) {
      break
    }
  }

  return comments
}

async function deleteReviewComment({ github, owner, repo, comment_id }) {
  await github.rest.pulls.deleteReviewComment({
    owner,
    repo,
    comment_id,
  })
}

async function deleteIssueComment({ github, owner, repo, comment_id }) {
  await github.rest.issues.deleteComment({
    owner,
    repo,
    comment_id,
  })
}

async function syncReviewComment({ github, owner, repo, pull_number, commit_id, existingComments, anchorPath, body }) {
  if (!anchorPath) {
    return
  }

  const reusableComment = existingComments.find((comment) => comment.path === anchorPath)
  const staleComments = existingComments.filter((comment) => comment.id !== reusableComment?.id)

  for (const comment of staleComments) {
    await deleteReviewComment({ github, owner, repo, comment_id: comment.id })
  }

  if (reusableComment) {
    if (reusableComment.body !== body) {
      await github.rest.pulls.updateReviewComment({
        owner,
        repo,
        comment_id: reusableComment.id,
        body,
      })
    }

    return
  }

  await github.rest.pulls.createReviewComment({
    owner,
    repo,
    pull_number,
    commit_id,
    path: anchorPath,
    subject_type: 'file',
    body,
  })
}

async function syncStickyIssueComment({ github, owner, repo, issue_number, existingComments, body }) {
  const reusableComment = existingComments[0]
  const staleComments = existingComments.slice(1)

  for (const comment of staleComments) {
    await deleteIssueComment({ github, owner, repo, comment_id: comment.id })
  }

  if (reusableComment) {
    if (reusableComment.body !== body) {
      await github.rest.issues.updateComment({
        owner,
        repo,
        comment_id: reusableComment.id,
        body,
      })
    }

    return
  }

  await github.rest.issues.createComment({
    owner,
    repo,
    issue_number,
    body,
  })
}

async function syncManagedPullRequestFeedback({ github, context, core, scopeName, key, mode, body, anchorPath = '' }) {
  const pullRequest = context.payload.pull_request

  if (!pullRequest) {
    core.info(`No pull_request payload available; skipping ${scopeName}:${key}.`)
    return
  }

  const owner = context.repo.owner
  const repo = context.repo.repo
  const pull_number = pullRequest.number
  const issue_number = pullRequest.number
  const commit_id = pullRequest.head.sha
  const marker = createManagedMarker({ scopeName, key })
  const managedBody = String(body).includes(marker) ? String(body) : `${marker}\n${String(body)}`

  const reviewComments = (await listPullReviewComments({ github, owner, repo, pull_number })).filter((comment) =>
    isManagedBotComment({ comment, marker }),
  )
  const issueComments = (await listPullIssueComments({ github, owner, repo, issue_number })).filter((comment) =>
    isManagedBotComment({ comment, marker }),
  )

  if (mode === 'none') {
    for (const comment of reviewComments) {
      await deleteReviewComment({ github, owner, repo, comment_id: comment.id })
    }

    for (const comment of issueComments) {
      await deleteIssueComment({ github, owner, repo, comment_id: comment.id })
    }

    return
  }

  if (mode === 'review') {
    for (const comment of issueComments) {
      await deleteIssueComment({ github, owner, repo, comment_id: comment.id })
    }

    const normalizedAnchorPath = normalizeAnchorPath(anchorPath)

    if (!normalizedAnchorPath) {
      core.warning(`No anchor path available for ${scopeName}:${key}; falling back is the caller's responsibility.`)
      return
    }

    await syncReviewComment({
      github,
      owner,
      repo,
      pull_number,
      commit_id,
      existingComments: reviewComments,
      anchorPath: normalizedAnchorPath,
      body: managedBody,
    })

    return
  }

  if (mode === 'sticky') {
    for (const comment of reviewComments) {
      await deleteReviewComment({ github, owner, repo, comment_id: comment.id })
    }

    await syncStickyIssueComment({
      github,
      owner,
      repo,
      issue_number,
      existingComments: issueComments,
      body: managedBody,
    })

    return
  }

  throw new Error(`Unsupported managed PR feedback mode: ${mode}`)
}

module.exports = {
  createManagedMarker,
  isManagedBotComment,
  syncManagedPullRequestFeedback,
}
