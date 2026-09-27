const path = 'src/features/transactionalEmail/lettermintTargetLocks.json'
const environments = ['preview', 'production']
const identifier = /^[A-Za-z0-9_-]{1,128}$/

function validTargets(value) {
  if (!value || !Array.isArray(value.targets)) return false
  if (value.targets.length > environments.length) return false
  const validShape = value.targets.every(
    (target) =>
      target !== null &&
      environments.includes(target.environment) &&
      ['teamId', 'projectId', 'routeId'].every(
        (field) => typeof target[field] === 'string' && identifier.test(target[field]),
      ),
  )
  if (!validShape) return false
  if (new Set(value.targets.map((target) => target.environment)).size !== value.targets.length) return false
  return ['teamId', 'projectId', 'routeId'].every(
    (field) => new Set(value.targets.map((target) => target[field])).size === value.targets.length,
  )
}

function preservesActivatedTargets(previous, current) {
  if (!validTargets(previous) || !validTargets(current)) return false
  return previous.targets.every((old) => {
    const next = current.targets.find((target) => target.environment === old.environment)
    return next && ['teamId', 'projectId', 'routeId'].every((field) => old[field] === next[field])
  })
}

async function targetLocksPreserved({ github, context }) {
  const { owner, repo } = context.repo
  const { base, head } = context.payload.pull_request
  async function readTargets(sourceOwner, sourceRepo, ref) {
    const response = await github.rest.repos.getContent({
      owner: sourceOwner,
      repo: sourceRepo,
      path,
      ref,
    })
    if (Array.isArray(response.data) || response.data.encoding !== 'base64') return null
    return JSON.parse(Buffer.from(response.data.content, 'base64').toString('utf8'))
  }
  try {
    const previous = await readTargets(owner, repo, base.sha)
    const current = await readTargets(head.repo.owner.login, head.repo.name, head.sha)
    return preservesActivatedTargets(previous, current)
  } catch (error) {
    if (error.status === 404) return false
    throw error
  }
}

module.exports = { preservesActivatedTargets, targetLocksPreserved }
