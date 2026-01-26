/**
 * PR Gates label automation
 *
 * Purpose
 * - Keep PR labels consistent with Conventional Commit titles (feat/fix/perf/etc).
 * - Automatically tag ADR changes so release notes can include a dedicated
 *   "Architecture Decision Records" section.
 *
 * How it works
 * - Derives a "managed" label from the PR title type (e.g. feat -> feature).
 * - Cleans up other managed labels so the PR has at most one of them.
 * - Adds an `adr` label when the PR touches `docs/adrs/**`.
 *
 * Notes
 * - Intended to run from `actions/github-script` in `pull_request_target`.
 * - ADR labeling is independent of the Conventional Commit type, so it still
 *   applies even if the PR title type is ignored (e.g. chore).
 */

const ADR_LABEL = 'adr'
const ADR_PATH_PREFIX = 'docs/adrs/'
const DEPRECATED_LABEL = 'codex'

const IGNORED_TYPES = new Set(['chore', 'style', 'revert'])

const TYPE_TO_LABEL = {
  feat: 'feature',
  fix: 'fix',
  perf: 'performance',
  refactor: 'refactor',
  docs: 'documentation',
  breaking: 'breaking',
  test: 'test',
  ci: 'ci',
  build: 'ci',
}

const MANAGED_LABELS = Array.from(new Set(Object.values(TYPE_TO_LABEL)))

async function listAllPullFiles({ github, owner, repo, pull_number }) {
  const changedFiles = []

  // GitHub API limit is 3000 files; we cap pages defensively.
  for (let page = 1; page <= 20; page++) {
    const { data } = await github.rest.pulls.listFiles({
      owner,
      repo,
      pull_number,
      per_page: 100,
      page,
    })

    if (!data?.length) break

    changedFiles.push(...data.map((f) => f.filename))

    if (data.length < 100) break
  }

  return changedFiles
}

async function ensureLabelExists({ github, owner, repo, name, color, description, core }) {
  try {
    await github.rest.issues.getLabel({ owner, repo, name })
  } catch (e) {
    if (e?.status === 404) {
      core.info(`Label "${name}" not found; creating.`)
      await github.rest.issues.createLabel({ owner, repo, name, color, description })
      return
    }

    throw e
  }
}

function extractConventionalTypeFromTitle(title) {
  const typeSegment = title.split(':')[0]
  const rawType = (typeSegment.includes('(') ? typeSegment.split('(')[0] : typeSegment).trim()
  return rawType.toLowerCase()
}

async function getIssueLabels({ github, owner, repo, issue_number }) {
  const { data: current } = await github.rest.issues.get({ owner, repo, issue_number })
  return current.labels
    .map((l) => (typeof l === 'string' ? l : l.name))
    .filter((l) => typeof l === 'string' && l.length > 0)
}

async function removeLabelIfPresent({ github, owner, repo, issue_number, name, core }) {
  try {
    await github.rest.issues.removeLabel({ owner, repo, issue_number, name })
    core.info(`Removed label "${name}".`)
  } catch (e) {
    // Removing a missing label yields 404; ignore.
    if (e?.status !== 404) {
      core.warning(`Failed to remove label ${name}: ${e.message}`)
    }
  }
}

async function addLabelIfMissing({ github, owner, repo, issue_number, name, existingLabels, core }) {
  if (existingLabels.includes(name)) {
    core.info(`Label "${name}" already present; nothing to do.`)
    return
  }

  core.info(`Adding label "${name}".`)
  await github.rest.issues.addLabels({ owner, repo, issue_number, labels: [name] })
}

module.exports = async function run({ github, context, core }) {
  const pr = context.payload.pull_request
  if (!pr) {
    core.info('No pull_request in context, skipping')
    return
  }

  const owner = context.repo.owner
  const repo = context.repo.repo
  const issue_number = pr.number

  const title = String(pr.title ?? '').trim()

  // Read current labels once and reuse for idempotent operations.
  const existingLabels = await getIssueLabels({ github, owner, repo, issue_number })

  // 1) Cleanup deprecated labels.
  if (existingLabels.includes(DEPRECATED_LABEL)) {
    core.info(`Removing deprecated label "${DEPRECATED_LABEL}"`)
    await removeLabelIfPresent({ github, owner, repo, issue_number, name: DEPRECATED_LABEL, core })
  }

  // 2) Conventional Commit derived label (feature/fix/performance/etc).
  const type = extractConventionalTypeFromTitle(title)
  if (!IGNORED_TYPES.has(type)) {
    const desired = TYPE_TO_LABEL[type]

    if (desired) {
      const refreshedLabels = await getIssueLabels({ github, owner, repo, issue_number })

      const extraneous = refreshedLabels.filter((l) => MANAGED_LABELS.includes(l) && l !== desired)

      if (extraneous.length === 0 && refreshedLabels.includes(desired)) {
        core.info(`Label "${desired}" already present and no other managed labels to adjust.`)
      } else {
        for (const label of extraneous) {
          core.info(`Removing extraneous label ${label}`)
          await removeLabelIfPresent({ github, owner, repo, issue_number, name: label, core })
        }

        const afterCleanup = await getIssueLabels({ github, owner, repo, issue_number })
        await addLabelIfMissing({
          github,
          owner,
          repo,
          issue_number,
          name: desired,
          existingLabels: afterCleanup,
          core,
        })
      }
    } else {
      core.info(`No mapped label for type "${type}"; skipping Conventional Commit labeling.`)
    }
  } else {
    core.info(`Type "${type}" is ignored; skipping Conventional Commit labeling.`)
  }

  // 3) ADR label based on changed files.
  const changedFiles = await listAllPullFiles({ github, owner, repo, pull_number: issue_number })
  const touchesAdrs = changedFiles.some((p) => p.startsWith(ADR_PATH_PREFIX))

  if (!touchesAdrs) {
    core.info(`No files under "${ADR_PATH_PREFIX}" changed; skipping ${ADR_LABEL} label.`)
    return
  }

  await ensureLabelExists({
    github,
    owner,
    repo,
    name: ADR_LABEL,
    color: '0E8A16',
    description: 'Pull requests that add or update Architecture Decision Records (docs/adrs/**).',
    core,
  })

  const refreshedLabels = await getIssueLabels({ github, owner, repo, issue_number })
  await addLabelIfMissing({
    github,
    owner,
    repo,
    issue_number,
    name: ADR_LABEL,
    existingLabels: refreshedLabels,
    core,
  })
}
