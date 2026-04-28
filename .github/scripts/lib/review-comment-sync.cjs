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

const createManagedMarker = ({ scopeName, categoryKey }) => `<!-- review-comment-sync:${scopeName}:${categoryKey} -->`

async function listPullFiles({ github, owner, repo, pull_number }) {
  const files = []

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { data } = await github.rest.pulls.listFiles({
      owner,
      repo,
      pull_number,
      per_page: PAGE_SIZE,
      page,
    })

    if (!data?.length) {
      break
    }

    files.push(...data)

    if (data.length < PAGE_SIZE) {
      break
    }
  }

  return files
}

async function listReviewComments({ github, owner, repo, pull_number }) {
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

async function deleteReviewComment({ github, owner, repo, comment_id }) {
  await github.rest.pulls.deleteReviewComment({
    owner,
    repo,
    comment_id,
  })
}

function isManagedBotComment({ comment, marker }) {
  const body = String(comment.body ?? '')
  const login = String(comment.user?.login ?? '')
  const userType = String(comment.user?.type ?? '')

  return body.includes(marker) && login === 'github-actions[bot]' && userType === 'Bot'
}

async function syncCategoryComment({
  github,
  owner,
  repo,
  pull_number,
  commit_id,
  existingComments,
  active,
  anchorPath,
  body,
}) {
  if (!active) {
    for (const comment of existingComments) {
      await deleteReviewComment({ github, owner, repo, comment_id: comment.id })
    }

    return
  }

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

async function syncManagedFileReviewComments({ github, context, core, scopeName, categories }) {
  const pullRequest = context.payload.pull_request

  if (!pullRequest) {
    core.info(`No pull_request payload available; skipping ${scopeName}.`)
    return
  }

  const owner = context.repo.owner
  const repo = context.repo.repo
  const pull_number = pullRequest.number
  const commit_id = pullRequest.head.sha

  const files = await listPullFiles({ github, owner, repo, pull_number })
  const reviewComments = await listReviewComments({ github, owner, repo, pull_number })

  const categoryStates = {}

  for (const category of categories) {
    const marker = createManagedMarker({ scopeName, categoryKey: category.key })

    categoryStates[category.key] = {
      marker,
      existingComments: reviewComments.filter((comment) => isManagedBotComment({ comment, marker })),
      active: false,
      anchorPath: '',
      body: '',
    }
  }

  for (const category of categories) {
    categoryStates[category.key].active = Boolean(
      await category.isActive({
        files,
        pullRequest,
        context,
        github,
        core,
        categoryStates,
      }),
    )
  }

  const activeCategoryCount = Object.values(categoryStates).filter((categoryState) => categoryState.active).length

  if (activeCategoryCount === 0) {
    core.info(`No active review comment categories for ${scopeName}.`)
  }

  for (const category of categories) {
    const categoryState = categoryStates[category.key]

    if (categoryState.active) {
      categoryState.anchorPath = normalizeAnchorPath(
        await category.getAnchorPath({
          files,
          pullRequest,
          context,
          github,
          core,
          categoryStates,
        }),
      )

      if (!categoryState.anchorPath) {
        core.warning(`No anchor path available for ${scopeName}:${category.key}.`)
      } else {
        const body = await category.buildBody({
          files,
          pullRequest,
          context,
          github,
          core,
          categoryStates,
          marker: categoryState.marker,
        })

        categoryState.body = String(body).includes(categoryState.marker)
          ? String(body)
          : `${categoryState.marker}\n${String(body)}`
      }
    }

    await syncCategoryComment({
      github,
      owner,
      repo,
      pull_number,
      commit_id,
      existingComments: categoryState.existingComments,
      active: categoryState.active,
      anchorPath: categoryState.anchorPath,
      body: categoryState.body,
    })
  }
}

module.exports = {
  createManagedMarker,
  isManagedBotComment,
  syncManagedFileReviewComments,
}
