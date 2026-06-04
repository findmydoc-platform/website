#!/usr/bin/env node

import { spawnSync } from 'node:child_process'

const CONVENTIONAL_RE = /^([a-z]+)(\(([^)]+)\))?(!)?:\s+(.+)$/i
const PATCH_TYPES = new Set(['build', 'chore', 'ci', 'docs', 'fix', 'perf', 'refactor', 'revert', 'style', 'test'])

const INTERNAL_KEYWORDS = [
  'actionlint',
  'ci',
  'dependabot',
  'deps',
  'docs',
  'documentation',
  'readme',
  'registry metadata',
  'storybook',
  'workflow',
]

const FEATURE_SECTION_RE = /(feature|capabilit|enhancement|new)/i
const FIX_SECTION_RE = /(improvement|fix|bug|other changes|security)/i
const FEATURE_REFERENCE_TITLE_RE = /^(feature|enhancement|capability)\b/i
const MAJOR_CONTEXT_PATTERNS = [
  /\bbreaking\b/i,
  /\bbackward incompatible\b/i,
  /\bincompatible\b/i,
  /\bmigration required\b/i,
]
export const GOOGLE_CHAT_SECRET_NAME = 'GOOGLE_CHAT_WEBHOOK_URL' // pragma: allowlist secret
export const GOOGLE_CHAT_WORKFLOW_FILE = 'send-release-google-chat.yml'
export const PRODUCTION_DEPLOY_WORKFLOW_FILE = 'deploy-production.yml'

const GOOGLE_CHAT_IMAGE_MAX_BYTES = 1.5 * 1024 * 1024
const GOOGLE_CHAT_IMAGE_MAX_HEIGHT = 1400
const GOOGLE_CHAT_IMAGE_MAX_ASPECT_RATIO = 2.4
const GOOGLE_CHAT_IMAGE_LIMIT = 4
const GOOGLE_CHAT_VISUAL_ITEM_LIMIT = 3
const GOOGLE_CHAT_ALLOWED_IMAGE_CONTENT_TYPES = new Set(['image/png', 'image/jpeg'])
const GOOGLE_CHAT_ALLOWED_IMAGE_HOSTS = new Set(['github.com', 'user-images.githubusercontent.com'])
const GOOGLE_CHAT_ALLOWED_GITHUB_ATTACHMENT_PREFIX = '/user-attachments/assets/'
const GOOGLE_CHAT_RELEASE_ROLE_PRIORITY = new Map([
  ['primary', 0],
  ['secondary', 1],
])
const GOOGLE_CHAT_VISUAL_KEYWORDS = [
  'desktop',
  'design',
  'funnel',
  'gallery',
  'image',
  'layout',
  'listing',
  'media',
  'mobile',
  'registration',
  'responsive',
  'screenshot',
  'ui',
  'ux',
  'visual',
]
const GOOGLE_CHAT_NON_VISUAL_PATTERNS = [
  /\ba11y\b/i,
  /\bapi\b/i,
  /\baria\b/i,
  /\bci\b/i,
  /\blint\b/i,
  /\bseo\b/i,
  /\btypegen\b/i,
  /\btypes?\b/i,
  /\burl validation\b/i,
  /\bworkflow\b/i,
  /\bworkflows\b/i,
  /\baccessib/i,
  /\bmetadata\b/i,
  /\bscreen reader\b/i,
]

/**
 * @typedef {{
 *   number: number
 *   title: string
 *   body?: string
 *   url?: string
 *   sections?: unknown[]
 * }} NarrativeIssueReference
 */

/**
 * @typedef {{
 *   number: number
 *   title: string
 *   body?: string
 *   url?: string
 *   issues?: NarrativeIssueReference[]
 *   narrative?: unknown
 *   sections?: unknown[]
 *   visual_candidates?: unknown[]
 * }} NarrativePullRequestReference
 */

/**
 * @typedef {{
 *   sha?: string
 *   subject: string
 *   type?: string
 *   level?: string
 *   conventional?: boolean
 * }} ReleaseCommit
 */

/**
 * @typedef {{
 *   ref?: string
 *   inputs?: Record<string, string> | null
 * }} WorkflowDispatchPayloadOptions
 */

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function run(command, args = [], options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: {
      ...process.env,
      ...options.env,
    },
    encoding: 'utf8',
    input: options.input,
  })

  const stdout = (result.stdout ?? '').trim()
  const stderr = (result.stderr ?? '').trim()

  if ((result.status ?? 1) !== 0 && !options.allowFailure) {
    const error = new Error(`${command} ${args.join(' ')} failed with exit code ${result.status ?? 'unknown'}`)
    error.stdout = stdout
    error.stderr = stderr
    error.status = result.status ?? 1
    throw error
  }

  return {
    status: result.status ?? 0,
    stdout,
    stderr,
  }
}

export function runJson(command, args = [], options = {}) {
  const { stdout } = run(command, args, options)
  return stdout ? JSON.parse(stdout) : null
}

export function parseRepoSlug(remoteUrl) {
  const normalized = remoteUrl.trim()
  const httpsMatch = normalized.match(/github\.com[/:]([^/]+\/[^/.]+)(?:\.git)?$/i)
  if (httpsMatch) {
    return httpsMatch[1]
  }

  throw new Error(`Could not parse GitHub repository slug from remote URL: ${remoteUrl}`)
}

export function readArgValue(args, flag) {
  const index = args.indexOf(flag)
  if (index === -1) {
    return null
  }

  return args[index + 1] ?? null
}

export function readRepeatedArgValues(args, flag) {
  const values = []

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== flag) {
      continue
    }

    const value = args[index + 1] ?? null
    if (value) {
      values.push(value)
    }
  }

  return values
}

export function parseChatMessageOverrides(args) {
  const overrides = {
    headline: readArgValue(args, '--chat-headline') ?? undefined,
    summary: readArgValue(args, '--chat-summary') ?? undefined,
    addLines: readRepeatedArgValues(args, '--chat-add-line'),
    removePatterns: readRepeatedArgValues(args, '--chat-remove-pattern'),
  }

  return overrides
}

export function hasChatMessageOverrides(overrides) {
  return Boolean(
    overrides.headline ||
    overrides.summary ||
    (overrides.addLines && overrides.addLines.length > 0) ||
    (overrides.removePatterns && overrides.removePatterns.length > 0),
  )
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`
}

export function formatChatOverridesForShell(overrides) {
  const parts = []

  if (overrides.headline) {
    parts.push(`--chat-headline ${shellQuote(overrides.headline)}`)
  }

  if (overrides.summary) {
    parts.push(`--chat-summary ${shellQuote(overrides.summary)}`)
  }

  for (const line of overrides.addLines ?? []) {
    parts.push(`--chat-add-line ${shellQuote(line)}`)
  }

  for (const pattern of overrides.removePatterns ?? []) {
    parts.push(`--chat-remove-pattern ${shellQuote(pattern)}`)
  }

  return parts.join(' ')
}

export function getRepoSlug(cwd = process.cwd()) {
  const remoteUrl = run('git', ['remote', 'get-url', 'origin'], { cwd }).stdout
  return parseRepoSlug(remoteUrl)
}

export function parseVersion(tag) {
  const match = tag.match(/^v(\d+)\.(\d+)\.(\d+)$/)
  if (!match) {
    throw new Error(`Invalid semantic version tag: ${tag}`)
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  }
}

export function bumpVersion(tag, bump) {
  const version = parseVersion(tag)
  if (bump === 'major') {
    return `v${version.major + 1}.0.0`
  }

  if (bump === 'minor') {
    return `v${version.major}.${version.minor + 1}.0`
  }

  if (bump === 'patch') {
    return `v${version.major}.${version.minor}.${version.patch + 1}`
  }

  throw new Error(`Unsupported bump level: ${bump}`)
}

export function getLatestReleaseTag(ref = 'HEAD', cwd = process.cwd()) {
  const { stdout } = run('git', ['tag', '--merged', ref, '--sort=-v:refname', '--list', 'v*.*.*'], { cwd })
  const tag = stdout
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean)
  return tag ?? null
}

export function getCommitRange(lastTag, ref = 'HEAD') {
  return `${lastTag}..${ref}`
}

export function parseCommitRecord(record) {
  const [sha, subject, body] = record.split('\u001f')
  const header = subject.trim()
  const fullBody = body.trim()
  const headerMatch = header.match(CONVENTIONAL_RE)
  const explicitBreaking = /(^|\n)BREAKING CHANGE:\s+/m.test(fullBody)

  if (!headerMatch) {
    return {
      sha,
      subject: header,
      body: fullBody,
      conventional: false,
      type: null,
      scope: null,
      description: header,
      breaking: explicitBreaking,
      level: explicitBreaking ? 'major' : 'patch',
      reason: explicitBreaking ? 'breaking footer detected' : 'non-conventional commit treated as patch fallback',
    }
  }

  const [, typeRaw, , scopeRaw, bang, descriptionRaw] = headerMatch
  const type = typeRaw.toLowerCase()
  const scope = scopeRaw ?? null
  const description = descriptionRaw.trim()
  const breaking = explicitBreaking || Boolean(bang)
  let level = 'patch'
  let reason = 'patch-level change'

  if (breaking) {
    level = 'major'
    reason = 'breaking change'
  } else if (type === 'feat') {
    level = 'minor'
    reason = 'feature commit'
  } else if (PATCH_TYPES.has(type)) {
    level = 'patch'
    reason = `${type} commit`
  }

  return {
    sha,
    subject: header,
    body: fullBody,
    conventional: true,
    type,
    scope,
    description,
    breaking,
    level,
    reason,
  }
}

export function getCommitsSinceTag(lastTag, ref = 'HEAD', cwd = process.cwd()) {
  const format = '%H%x1f%s%x1f%B%x1e'
  const { stdout } = run('git', ['log', getCommitRange(lastTag, ref), `--format=${format}`], {
    cwd,
  })

  return stdout
    .split('\u001e')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map(parseCommitRecord)
}

export function determineNextRelease(lastTag, ref = 'HEAD', cwd = process.cwd()) {
  const commits = getCommitsSinceTag(lastTag, ref, cwd)
  if (commits.length === 0) {
    throw new Error(`No commits found since ${lastTag}.`)
  }

  let bump = 'patch'
  if (commits.some((commit) => commit.level === 'major')) {
    bump = 'major'
  } else if (commits.some((commit) => commit.level === 'minor')) {
    bump = 'minor'
  }

  const nextTag = bumpVersion(lastTag, bump)
  const counts = {
    major: commits.filter((commit) => commit.level === 'major').length,
    minor: commits.filter((commit) => commit.level === 'minor').length,
    patch: commits.filter((commit) => commit.level === 'patch').length,
    conventional: commits.filter((commit) => commit.conventional).length,
    nonConventional: commits.filter((commit) => !commit.conventional).length,
    linkedFeatureSignals: 0,
  }

  const bumpReason =
    bump === 'major'
      ? 'Breaking changes detected in commit history.'
      : bump === 'minor'
        ? 'At least one feature commit detected and no breaking changes found.'
        : counts.nonConventional > 0
          ? 'Only patch-level or non-conventional commits detected; using patch fallback.'
          : 'Only patch-level changes detected.'

  return {
    lastTag,
    nextTag,
    bump,
    bumpReason,
    commitCount: commits.length,
    counts,
    commits,
  }
}

function hasFeatureReferenceSignal(reference) {
  const title = cleanNarrativeText(reference.title ?? '')
  const conventionalType = parseConventionalTypeFromText(reference.title ?? '')
  if (conventionalType === 'feat' || FEATURE_REFERENCE_TITLE_RE.test(title)) {
    return true
  }

  return (reference.issues ?? []).some((issue) =>
    FEATURE_REFERENCE_TITLE_RE.test(cleanNarrativeText(issue.title ?? '')),
  )
}

function hasMajorContextSignal(reference) {
  const candidateTexts = [
    reference.title ?? '',
    reference.body ?? '',
    ...(reference.issues ?? []).flatMap((issue) => [issue.title ?? '', issue.body ?? '']),
  ].map((value) => cleanNarrativeText(value))

  return candidateTexts.some((text) => MAJOR_CONTEXT_PATTERNS.some((pattern) => pattern.test(text)))
}

function buildTechnicalAssessment(releasePlan) {
  return {
    bump: releasePlan.bump,
    nextTag: releasePlan.nextTag,
    reason: releasePlan.bumpReason,
    source: 'commit-history',
  }
}

export function assessContextualReleaseFromReferences(releasePlan, references = []) {
  const enrichedReferences = references.map((reference) =>
    reference.narrative && reference.sections && (reference.issues ?? []).every((issue) => issue.sections)
      ? reference
      : enrichNarrativeReference(reference),
  )
  const visibleReferences = visibleNarrativeReferences(enrichedReferences)
  const linkedMajorReferences = visibleReferences.filter(hasMajorContextSignal)
  const linkedFeatureReferences = visibleReferences.filter(hasFeatureReferenceSignal)
  const technicalAssessment = buildTechnicalAssessment(releasePlan)

  if (linkedMajorReferences.length > 0 && releasePlan.bump !== 'major') {
    return {
      technicalAssessment,
      contextualAssessment: {
        bump: 'major',
        nextTag: bumpVersion(releasePlan.lastTag, 'major'),
        reason:
          'The PR and issue context contains explicit breaking or migration signals, so the human review should consider a major release.',
        source: 'context-review',
      },
      linkedFeatureSignals: linkedFeatureReferences.length,
      references: visibleReferences,
    }
  }

  if (linkedFeatureReferences.length === 0 || releasePlan.bump === 'major') {
    return {
      technicalAssessment,
      contextualAssessment: {
        bump: technicalAssessment.bump,
        nextTag: technicalAssessment.nextTag,
        reason:
          linkedFeatureReferences.length === 0
            ? 'The PR and issue context does not currently justify a larger semantic release than the commit history.'
            : 'The PR and issue context does not outweigh the breaking-change signal already found in commit history.',
        source: 'context-review',
      },
      linkedFeatureSignals: linkedFeatureReferences.length,
      references: visibleReferences,
    }
  }

  if (releasePlan.bump === 'minor') {
    return {
      technicalAssessment,
      contextualAssessment: {
        bump: technicalAssessment.bump,
        nextTag: technicalAssessment.nextTag,
        reason: 'The PR and issue context supports the minor release already indicated by the commit history.',
        source: 'context-review',
      },
      linkedFeatureSignals: linkedFeatureReferences.length,
      references: visibleReferences,
    }
  }

  return {
    technicalAssessment,
    contextualAssessment: {
      bump: 'minor',
      nextTag: bumpVersion(releasePlan.lastTag, 'minor'),
      reason:
        'The PR and issue context suggests a feature-level release even though the commit messages are currently patch-labeled.',
      source: 'context-review',
    },
    linkedFeatureSignals: linkedFeatureReferences.length,
    references: visibleReferences,
  }
}

export async function determineNextReleaseWithReferences({
  lastTag,
  ref = 'HEAD',
  cwd = process.cwd(),
  repoSlug = null,
  runJsonImpl = runJson,
}) {
  const releasePlan = determineNextRelease(lastTag, ref, cwd)
  const effectiveRepoSlug = repoSlug ?? getRepoSlug(cwd)
  const references = await fetchAssociatedPullRequestIssueReferencesFromCommits({
    repoSlug: effectiveRepoSlug,
    commits: releasePlan.commits,
    cwd,
    runJsonImpl,
  })

  const contextualReview = assessContextualReleaseFromReferences(releasePlan, references)

  return {
    ...releasePlan,
    counts: {
      ...releasePlan.counts,
      linkedFeatureSignals: contextualReview.linkedFeatureSignals,
    },
    references: contextualReview.references,
    technicalAssessment: contextualReview.technicalAssessment,
    contextualAssessment: contextualReview.contextualAssessment,
  }
}

export function ensureGhAuth(cwd = process.cwd()) {
  run('gh', ['auth', 'status'], { cwd })
}

export function getCurrentBranch(cwd = process.cwd()) {
  return run('git', ['branch', '--show-current'], { cwd }).stdout
}

export function getHeadSha(ref = 'HEAD', cwd = process.cwd()) {
  return run('git', ['rev-parse', ref], { cwd }).stdout
}

export function fetchMainAndTags(cwd = process.cwd()) {
  run('git', ['fetch', 'origin', 'main', '--tags'], { cwd })
}

export function getGitStatusPorcelain(cwd = process.cwd()) {
  return run('git', ['status', '--porcelain'], { cwd }).stdout
}

export function releaseExists(repoSlug, tag, cwd = process.cwd()) {
  const result = run('gh', ['api', `repos/${repoSlug}/releases/tags/${tag}`], { cwd, allowFailure: true })
  return result.status === 0
}

export function tagExists(tag, cwd = process.cwd()) {
  const result = run('git', ['rev-parse', '-q', '--verify', `refs/tags/${tag}`], {
    cwd,
    allowFailure: true,
  })
  return result.status === 0
}

export function createRelease({ cwd = process.cwd(), repoSlug, tag, targetCommitish = 'main' }) {
  const payload = buildReleasePayload({ tag, targetCommitish })

  return runJson('gh', ['api', `repos/${repoSlug}/releases`, '--method', 'POST', '--input', '-'], {
    cwd,
    input: JSON.stringify(payload),
  })
}

export function buildReleasePayload({ tag, targetCommitish = 'main' }) {
  return {
    tag_name: tag,
    target_commitish: targetCommitish,
    name: tag,
    draft: false,
    prerelease: false,
    generate_release_notes: true,
  }
}

export function getReleaseByTag(repoSlug, tag, cwd = process.cwd()) {
  return runJson('gh', ['release', 'view', tag, '--repo', repoSlug, '--json', 'name,tagName,url,body'], {
    cwd,
  })
}

/**
 * @param {{
 *   cwd?: string
 *   repoSlug: string
 *   secretName: string
 *   runJsonImpl?: typeof runJson
 * }} options
 */
export function repositorySecretExists({ cwd = process.cwd(), repoSlug, secretName, runJsonImpl = runJson }) {
  const response = runJsonImpl('gh', ['secret', 'list', '--repo', repoSlug, '--json', 'name'], {
    cwd,
  })
  const secrets = Array.isArray(response) ? response : (response?.secrets ?? [])
  return secrets.some((secret) => secret.name === secretName)
}

export function dispatchWorkflow({ cwd = process.cwd(), repoSlug, workflowFile, ref = 'main', inputs = null }) {
  const dispatchedAt = new Date().toISOString()
  const payload = buildWorkflowDispatchPayload({ ref, inputs })
  run(
    'gh',
    ['api', `repos/${repoSlug}/actions/workflows/${workflowFile}/dispatches`, '--method', 'POST', '--input', '-'],
    {
      cwd,
      input: JSON.stringify(payload),
    },
  )
  return {
    dispatchedAt,
    ref,
    inputs,
  }
}

/**
 * @param {WorkflowDispatchPayloadOptions} options
 */
export function buildWorkflowDispatchPayload({ ref = 'main', inputs = null }) {
  if (inputs && Object.keys(inputs).length > 0) {
    return {
      ref,
      inputs,
    }
  }

  return { ref }
}

export async function waitForWorkflowRun({
  cwd = process.cwd(),
  repoSlug,
  workflowFile,
  ref = null,
  headSha,
  dispatchedAt,
  timeoutSeconds = Number(process.env.GH_RELEASE_PUBLISH_RUN_TIMEOUT_SECONDS ?? 1800),
  pollIntervalSeconds = Number(process.env.GH_RELEASE_PUBLISH_POLL_INTERVAL_SECONDS ?? 10),
}) {
  const startedAt = Date.now()
  let runInfo = null

  while (Date.now() - startedAt < timeoutSeconds * 1000) {
    const query = ref
      ? `repos/${repoSlug}/actions/workflows/${workflowFile}/runs?event=workflow_dispatch&branch=${encodeURIComponent(ref)}&per_page=10`
      : `repos/${repoSlug}/actions/workflows/${workflowFile}/runs?event=workflow_dispatch&per_page=10`
    const runs = runJson('gh', ['api', query], { cwd })

    runInfo =
      runs.workflow_runs.find(
        (candidate) =>
          candidate.head_sha === headSha &&
          new Date(candidate.created_at).getTime() >= new Date(dispatchedAt).getTime() - 1000,
      ) ?? null

    if (runInfo) {
      break
    }

    await sleep(pollIntervalSeconds * 1000)
  }

  if (!runInfo) {
    throw new Error(`Could not find workflow run for ${workflowFile} on ${ref}.`)
  }

  while (Date.now() - startedAt < timeoutSeconds * 1000) {
    const current = runJson('gh', ['api', `repos/${repoSlug}/actions/runs/${runInfo.id}`], {
      cwd,
    })

    if (current.status === 'completed') {
      if (current.conclusion !== 'success') {
        throw new Error(`Workflow run failed: ${current.html_url} (${current.conclusion ?? 'unknown conclusion'})`)
      }

      return current
    }

    await sleep(pollIntervalSeconds * 1000)
  }

  throw new Error(`Timed out while waiting for workflow run ${runInfo.id}.`)
}

export function parseReleaseNotesSections(markdown) {
  const sections = []
  let currentSection = {
    title: 'Overview',
    bullets: [],
  }

  for (const rawLine of markdown.split('\n')) {
    const line = rawLine.trim()
    if (!line) {
      continue
    }

    const headingMatch = line.match(/^##+\s+(.*)$/)
    if (headingMatch) {
      if (currentSection.bullets.length > 0 || currentSection.title !== 'Overview') {
        sections.push(currentSection)
      }
      currentSection = {
        title: headingMatch[1].trim(),
        bullets: [],
      }
      continue
    }

    const bulletMatch = line.match(/^[-*]\s+(.*)$/)
    if (bulletMatch) {
      currentSection.bullets.push(cleanReleaseNoteBullet(bulletMatch[1]))
    }
  }

  if (currentSection.bullets.length > 0 || currentSection.title !== 'Overview') {
    sections.push(currentSection)
  }

  return sections
}

export function cleanReleaseNoteBullet(text) {
  return text
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/\s+by @[A-Za-z0-9_-]+ in https:\/\/github\.com\/\S+$/g, '')
    .replace(/\s+in https:\/\/github\.com\/\S+$/g, '')
    .replace(CONVENTIONAL_RE, (_, type, _scopeWrap, scope, bang, description) => {
      const parts = []
      if (bang) {
        parts.push('breaking')
      }
      if (scope) {
        parts.push(scope)
      }
      if (
        type &&
        !['feat', 'fix', 'docs', 'ci', 'chore', 'refactor', 'perf', 'test', 'build', 'style', 'revert'].includes(
          type.toLowerCase(),
        )
      ) {
        parts.push(type)
      }
      const prefix = parts.length > 0 ? `${parts.join(' ')}: ` : ''
      return `${prefix}${description}`
    })
    .replace(/`/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isInternalBullet(text) {
  const normalized = text.toLowerCase()
  return INTERNAL_KEYWORDS.some((keyword) => normalized.includes(keyword))
}

function extractPrNumbers(input) {
  const values = []
  const patterns = [/#(\d+)/g, /\/pull\/(\d+)/g, /\/pulls\/(\d+)/g]

  for (const pattern of patterns) {
    const matches = input.matchAll(pattern)
    for (const match of matches) {
      values.push(Number(match[1]))
    }
  }

  return values
}

function uniqueNumbersInOrder(values) {
  const seen = new Set()
  const unique = []
  for (const value of values) {
    if (seen.has(value)) {
      continue
    }
    seen.add(value)
    unique.push(value)
  }
  return unique
}

function parseRepoOwnerAndName(repoSlug) {
  const [owner, name] = repoSlug.split('/')
  if (!owner || !name) {
    throw new Error(`Invalid repository slug: ${repoSlug}`)
  }
  return { owner, name }
}

const MAX_RELEASE_PULL_REQUESTS = Number(process.env.GH_RELEASE_PUBLISH_MAX_PULL_REQUESTS ?? 20)
const MAX_RELEASE_ISSUES_PER_PR = Number(process.env.GH_RELEASE_PUBLISH_MAX_ISSUES_PER_PR ?? 5)
const MAX_ASSOCIATED_PULL_REQUESTS_PER_COMMIT = Number(
  process.env.GH_RELEASE_PUBLISH_MAX_ASSOCIATED_PULL_REQUESTS_PER_COMMIT ?? 3,
)

const REFERENCE_SECTION_ALIASES = new Map([
  ['what changed', 'whatChanged'],
  ['problem statement', 'problemStatement'],
  ['intended outcome', 'intendedOutcome'],
  ['quality criteria', 'qualityCriteria'],
  ['acceptance criteria', 'acceptanceCriteria'],
  ['validation', 'validation'],
  ['screenshots', 'screenshots'],
  ['development', 'development'],
  ['out of scope', 'outOfScope'],
])

const TECHNICAL_NOISE_PATTERNS = [
  /^`?.+\.(png|json|tsx?|jsx?|yml|yaml|md)`?$/i,
  /^output\//i,
  /^pnpm\s/i,
  /^npm\s/i,
  /^yarn\s/i,
  /^pay?load_secret=/i,
  /^mobile_ui_reviewer/i,
  /^screenshots?:$/i,
]

const INLINE_TECHNICAL_PATTERNS = [
  /output\/\S+/gi,
  /https?:\/\/\S+/gi,
  /\b\d{3,4}x\d{3,4}\b/gi,
  /\b\d{3,4}(?:\/\d{3,4}){2,}\b/gi,
  /\b(?:src|tests|scripts|output)\/[^\s,]+/gi,
  /\b[A-Za-z0-9_./-]+\.(?:png|json|tsx?|jsx?|yml|yaml|md)\b/gi,
]
const TECHNICAL_NARRATIVE_LINE_PATTERNS = [
  /output\//i,
  /playwright/i,
  /storybook/i,
  /mobile_ui_reviewer/i,
  /unit test/i,
  /viewport matrix/i,
  /\b320\/375\/640\b/i,
  /\bheader, footer, holdingpageconcept\b/i,
  /\bbloghero, posthero, blogcard/i,
]

const INTERNAL_MAINTENANCE_KEYWORDS = ['actionlint', 'dependabot', 'deps', 'docs', 'ignore playwright local folders']
const PRODUCT_RELEVANT_TYPES = new Set(['feat', 'fix', 'perf', 'refactor', 'test'])
const FILTERED_INTERNAL_TYPES = new Set(['build', 'chore', 'ci', 'docs'])
const QUALITY_SIGNAL_RULES = [
  {
    label: 'End-to-End-Tests',
    pattern: /(playwright|end-to-end|e2e|runtime qa)/i,
  },
  {
    label: 'Regression-Checks',
    pattern: /(regression|storybook|visual|reviewer)/i,
  },
  {
    label: 'Integrationstests',
    pattern: /integration/i,
  },
  {
    label: 'Unit-Tests',
    pattern: /unit/i,
  },
  {
    label: 'Zusätzliche Qualitätsprüfung',
    pattern: /(qa|validation|quality criteria|acceptance criteria)/i,
  },
]

function normalizeSectionTitle(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function initializeReferenceSections() {
  return {
    overview: [],
    whatChanged: [],
    problemStatement: [],
    intendedOutcome: [],
    qualityCriteria: [],
    acceptanceCriteria: [],
    validation: [],
    screenshots: [],
    development: [],
    outOfScope: [],
    other: [],
  }
}

function cleanNarrativeText(text) {
  return cleanReleaseNoteBullet(text)
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/`/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripInlineTechnicalNoise(text) {
  return INLINE_TECHNICAL_PATTERNS.reduce((current, pattern) => current.replace(pattern, ' '), text)
    .replace(/\s+/g, ' ')
    .trim()
}

function isTechnicalNoise(text) {
  const normalized = text.trim()
  if (!normalized) {
    return true
  }

  return TECHNICAL_NOISE_PATTERNS.some((pattern) => pattern.test(normalized))
}

function normalizeForDedup(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function dedupeTexts(texts) {
  const seen = new Set()
  const unique = []

  for (const text of texts) {
    const normalized = normalizeForDedup(text)
    if (!normalized || seen.has(normalized)) {
      continue
    }

    seen.add(normalized)
    unique.push(text)
  }

  return unique
}

function parseReferenceBodySections(markdown) {
  const sections = initializeReferenceSections()
  let currentSection = 'overview'

  for (const rawLine of markdown.split('\n')) {
    const line = rawLine.trim()
    if (!line) {
      continue
    }

    const headingMatch = line.match(/^#{1,6}\s+(.*)$/)
    const sectionKey = REFERENCE_SECTION_ALIASES.get(normalizeSectionTitle(headingMatch?.[1] ?? line))
    if (sectionKey) {
      currentSection = sectionKey
      continue
    }

    const bulletMatch = line.match(/^[-*]\s+(.*)$/)
    const numberedMatch = line.match(/^\d+\.\s+(.*)$/)
    const content = bulletMatch?.[1] ?? numberedMatch?.[1] ?? line
    const cleaned = cleanNarrativeText(content)
    if (!cleaned) {
      continue
    }

    sections[currentSection].push(cleaned)
  }

  for (const [key, values] of Object.entries(sections)) {
    sections[key] = dedupeTexts(values)
  }

  return sections
}

function cleanGoogleChatVisualLabel(text) {
  return truncateForModelInput(cleanNarrativeText(text ?? '').replace(/<!--.*?-->/g, ' '), 100) || 'Release visual'
}

function inferGoogleChatVisualLabel(markdownBeforeImage, altText) {
  const previousLines = markdownBeforeImage
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-8)
    .reverse()

  for (const line of previousLines) {
    if (line.startsWith('<!--') || line.includes('![')) {
      continue
    }

    const headingMatch = line.match(/^#{1,6}\s+(.*)$/)
    if (headingMatch?.[1]) {
      return cleanGoogleChatVisualLabel(headingMatch[1])
    }

    const bulletMatch = line.match(/^[-*]\s+(.*)$/)
    if (bulletMatch?.[1]) {
      return cleanGoogleChatVisualLabel(bulletMatch[1])
    }

    return cleanGoogleChatVisualLabel(line)
  }

  return cleanGoogleChatVisualLabel(altText)
}

function extractMarkdownSectionBodies(markdown, sectionName) {
  const bodies = []
  const lines = String(markdown ?? '').split('\n')
  let activeSection = null

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/)
    if (headingMatch) {
      const headingLevel = headingMatch[1].length
      if (activeSection && headingLevel <= activeSection.level) {
        bodies.push(activeSection.lines.join('\n'))
        activeSection = null
      }

      if (!activeSection && normalizeSectionTitle(headingMatch[2] ?? '') === sectionName) {
        activeSection = {
          level: headingLevel,
          lines: [],
        }
        continue
      }
    }

    if (activeSection) {
      activeSection.lines.push(line)
    }
  }

  if (activeSection) {
    bodies.push(activeSection.lines.join('\n'))
  }

  return bodies
}

function extractMarkedGoogleChatScreenshotBlocks(markdown) {
  const blocks = []
  const text = String(markdown ?? '')
  const markerPattern = /<!--\s*gh-ui-screenshots:start\s*-->([\s\S]*?)<!--\s*gh-ui-screenshots:end\s*-->/gi
  let match = markerPattern.exec(text)

  while (match) {
    blocks.push(match[1] ?? '')
    match = markerPattern.exec(text)
  }

  return blocks
}

function parseGoogleChatScreenshotMetadata(markdownBeforeImage) {
  const metadataPattern = /<!--\s*gh-ui-screenshots:metadata\s+({[\s\S]*?})\s*-->/g
  let match = metadataPattern.exec(markdownBeforeImage)
  let metadata = null

  while (match) {
    try {
      metadata = JSON.parse(match[1])
    } catch {
      metadata = null
    }
    match = metadataPattern.exec(markdownBeforeImage)
  }

  return metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : null
}

function inferGoogleChatFormFactor(candidate) {
  const text = `${candidate.label ?? ''} ${candidate.altText ?? ''} ${candidate.url ?? ''}`.toLowerCase()
  if (text.includes('mobile')) return 'mobile'
  if (text.includes('tablet')) return 'tablet'
  if (text.includes('desktop')) return 'desktop'

  const width = Number(candidate.metadata?.width)
  if (Number.isFinite(width)) {
    if (width <= 480) return 'mobile'
    if (width <= 900) return 'tablet'
  }

  return 'desktop'
}

function extractMarkdownImageCandidatesFromText(markdown, { source, sourcePriority }) {
  const candidates = []
  const text = String(markdown ?? '')
  const imagePattern = /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)(?:\s+"[^"]*")?\)/gi
  let match = imagePattern.exec(text)

  while (match) {
    const altText = cleanGoogleChatVisualLabel(match[1] ?? '')
    const url = String(match[2] ?? '').trim()
    const markdownBeforeImage = text.slice(0, match.index)
    const label = inferGoogleChatVisualLabel(markdownBeforeImage, altText)
    const metadata = parseGoogleChatScreenshotMetadata(markdownBeforeImage)
    candidates.push({
      url,
      altText,
      label,
      metadata,
      source,
      sourcePriority,
      sourceIndex: candidates.length,
    })
    match = imagePattern.exec(text)
  }

  return candidates
}

export function extractGoogleChatPrImageCandidates(markdown) {
  const candidates = []

  for (const block of extractMarkedGoogleChatScreenshotBlocks(markdown)) {
    candidates.push(
      ...extractMarkdownImageCandidatesFromText(block, {
        source: 'ui-ux-marker',
        sourcePriority: 0,
      }),
    )
  }

  for (const section of extractMarkdownSectionBodies(markdown, 'ui ux')) {
    candidates.push(
      ...extractMarkdownImageCandidatesFromText(section, {
        source: 'ui-ux',
        sourcePriority: 1,
      }),
    )
  }

  for (const section of extractMarkdownSectionBodies(markdown, 'screenshots')) {
    candidates.push(
      ...extractMarkdownImageCandidatesFromText(section, {
        source: 'screenshots',
        sourcePriority: 2,
      }),
    )
  }

  candidates.push(
    ...extractMarkdownImageCandidatesFromText(markdown, {
      source: 'body',
      sourcePriority: 3,
    }),
  )

  const seenUrls = new Set()
  return candidates
    .filter((candidate) => {
      if (seenUrls.has(candidate.url)) {
        return false
      }

      seenUrls.add(candidate.url)
      return true
    })
    .map((candidate, index) => ({
      ...candidate,
      index,
      formFactor: inferGoogleChatFormFactor(candidate),
    }))
}

function tokenizeVisualText(text) {
  const stopWords = new Set([
    'der',
    'die',
    'das',
    'und',
    'mit',
    'für',
    'von',
    'zu',
    'zur',
    'zum',
    'ist',
    'sind',
    'release',
    'findmydoc',
  ])
  return new Set(
    String(text ?? '')
      .toLowerCase()
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe')
      .replace(/ü/g, 'ue')
      .replace(/ß/g, 'ss')
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 4 && !stopWords.has(token)),
  )
}

export function extractGoogleChatReleaseVisualItems(messageText, { maxItems = GOOGLE_CHAT_VISUAL_ITEM_LIMIT } = {}) {
  const lines = String(messageText ?? '').split('\n')
  const items = []
  let activeItem = null

  for (const line of lines) {
    const itemMatch = line.trim().match(/^(\d+)[.)]\s+(.+)$/)
    if (itemMatch) {
      if (activeItem) {
        items.push(activeItem)
      }
      activeItem = {
        index: Number(itemMatch[1]),
        title: collapseWhitespace(itemMatch[2]),
        bodyLines: [],
      }
      continue
    }

    if (activeItem) {
      activeItem.bodyLines.push(line)
    }
  }

  if (activeItem) {
    items.push(activeItem)
  }

  return items.slice(0, maxItems).map((item) => {
    const body = collapseWhitespace(item.bodyLines.join(' '))
    return {
      index: item.index,
      title: item.title,
      body,
      tokens: tokenizeVisualText(`${item.title} ${body}`),
    }
  })
}

function visualCandidateHasReleaseMetadata(candidate) {
  return candidate.metadata && typeof candidate.metadata === 'object'
}

function visualCandidateIsReleaseMarked(candidate) {
  return (
    candidate.metadata?.releaseEligible === true &&
    GOOGLE_CHAT_RELEASE_ROLE_PRIORITY.has(candidate.metadata?.releaseRole)
  )
}

function releaseCandidatePoolForPullRequest(pullRequest) {
  const candidates = pullRequest.visual_candidates ?? []
  if (candidates.some(visualCandidateHasReleaseMetadata)) {
    return candidates.filter(visualCandidateIsReleaseMarked)
  }

  return candidates
}

function pullRequestHasMarkedReleaseVisual(pullRequest) {
  return (pullRequest.visual_candidates ?? []).some(visualCandidateIsReleaseMarked)
}

function pullRequestLooksVisual(pullRequest) {
  const fields = [
    pullRequest.title,
    pullRequest.source_title,
    pullRequest.body_context,
    pullRequest.what_changed,
    pullRequest.user_impact_signals,
    pullRequest.linked_issues?.map((issue) => [
      issue.title,
      issue.source_title,
      issue.problem_statement,
      issue.intended_outcome,
    ]),
  ]
    .flat(3)
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (!fields.trim()) {
    return true
  }

  const hasVisualSignal = GOOGLE_CHAT_VISUAL_KEYWORDS.some((keyword) => fields.includes(keyword))
  const hasNonVisualSignal = GOOGLE_CHAT_NON_VISUAL_PATTERNS.some((pattern) => pattern.test(fields))
  return hasVisualSignal || !hasNonVisualSignal
}

function scoreVisualForItem(visual, item) {
  const visualTokens = tokenizeVisualText(
    [
      visual.prTitle,
      visual.label,
      visual.metadata?.focus,
      visual.metadata?.focusLabel,
      visual.metadata?.formFactor,
      visual.metadata?.releaseRole,
    ]
      .filter(Boolean)
      .join(' '),
  )
  let score = 0
  for (const token of visualTokens) {
    if (item.tokens.has(token)) {
      score += 8
    }
  }

  if (visual.metadata?.releaseRole === 'primary') score += 40
  if (visual.metadata?.releaseRole === 'secondary') score += 25
  if (visual.metadata?.releaseEligible === true) score += 20
  if (visual.label.toLowerCase().includes(item.title.toLowerCase())) score += 10

  return score
}

function buildFallbackReleaseVisualItems(visuals) {
  return visuals.slice(0, GOOGLE_CHAT_VISUAL_ITEM_LIMIT).map((visual, index) => ({
    index: index + 1,
    title: visual.label || visual.prTitle || `Release visual ${index + 1}`,
    body: '',
    tokens: tokenizeVisualText(`${visual.label} ${visual.prTitle}`),
  }))
}

function assignVisualsToReleaseItems({ visuals, visualItems, maxImages }) {
  const items = visualItems.length > 0 ? visualItems : buildFallbackReleaseVisualItems(visuals)
  const selected = []
  const usedImageUrls = new Set()

  for (const item of items) {
    if (selected.length >= maxImages) {
      break
    }

    const ranked = visuals
      .filter((visual) => !usedImageUrls.has(visual.imageUrl))
      .map((visual) => ({
        ...visual,
        item,
        itemScore: scoreVisualForItem(visual, item),
      }))
      .sort(
        (left, right) =>
          right.itemScore - left.itemScore ||
          (GOOGLE_CHAT_RELEASE_ROLE_PRIORITY.get(left.metadata?.releaseRole) ?? 9) -
            (GOOGLE_CHAT_RELEASE_ROLE_PRIORITY.get(right.metadata?.releaseRole) ?? 9) ||
          left.sourcePriority - right.sourcePriority ||
          left.candidateIndex - right.candidateIndex,
      )

    const primaryVisual = ranked[0]
    if (!primaryVisual) {
      continue
    }

    const itemSelection = [primaryVisual]
    if (item.index === items[0]?.index && selected.length + itemSelection.length < maxImages) {
      const pairedVisual =
        ranked.find(
          (visual) =>
            visual.imageUrl !== primaryVisual.imageUrl &&
            visual.prNumber === primaryVisual.prNumber &&
            visual.formFactor !== primaryVisual.formFactor,
        ) ??
        ranked.find(
          (visual) =>
            visual.imageUrl !== primaryVisual.imageUrl &&
            visual.formFactor !== primaryVisual.formFactor &&
            visual.itemScore >= Math.max(primaryVisual.itemScore - 8, 0),
        )
      if (pairedVisual) {
        itemSelection.push(pairedVisual)
      }
    }

    for (const visual of itemSelection) {
      if (selected.length >= maxImages) {
        break
      }
      usedImageUrls.add(visual.imageUrl)
      selected.push({
        ...visual,
        itemIndex: item.index,
        itemTitle: item.title,
      })
    }
  }

  return selected
}

function formatReleaseVisualItem(item) {
  return {
    index: item.index,
    title: item.title,
  }
}

function formatReleaseVisualResult(visual) {
  return {
    contentType: visual.contentType,
    formFactor: visual.formFactor,
    height: visual.height,
    imageUrl: visual.imageUrl,
    itemIndex: visual.itemIndex,
    itemTitle: visual.itemTitle,
    label: visual.label,
    prNumber: visual.prNumber,
    prTitle: visual.prTitle,
    prUrl: visual.prUrl,
    releaseRole: visual.metadata?.releaseRole ?? null,
    sizeBytes: visual.sizeBytes,
    source: visual.source,
    width: visual.width,
  }
}

function googleChatImageUrlHasAllowedOrigin(url) {
  let parsedUrl
  try {
    parsedUrl = new URL(url)
  } catch {
    return false
  }

  if (parsedUrl.protocol !== 'https:') {
    return false
  }

  if (!GOOGLE_CHAT_ALLOWED_IMAGE_HOSTS.has(parsedUrl.hostname)) {
    return false
  }

  return (
    parsedUrl.hostname === 'user-images.githubusercontent.com' ||
    parsedUrl.pathname.startsWith(GOOGLE_CHAT_ALLOWED_GITHUB_ATTACHMENT_PREFIX)
  )
}

async function readLimitedResponseBody(response, maxBytes) {
  if (!response.body?.getReader) {
    if (typeof response.arrayBuffer !== 'function') {
      return null
    }

    const body = await response.arrayBuffer()
    return {
      buffer: Buffer.from(body),
      tooLarge: body.byteLength > maxBytes,
    }
  }

  const reader = response.body.getReader()
  const chunks = []
  let totalBytes = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }

      const chunk = Buffer.from(value)
      totalBytes += chunk.byteLength
      if (totalBytes > maxBytes) {
        await reader.cancel?.('google_chat_image_too_large')
        return {
          buffer: Buffer.concat([...chunks, chunk], Math.min(totalBytes, maxBytes + 1)),
          tooLarge: true,
        }
      }
      chunks.push(chunk)
    }
  } finally {
    reader.releaseLock?.()
  }

  return {
    buffer: Buffer.concat(chunks, totalBytes),
    tooLarge: false,
  }
}

export async function validateGoogleChatImageUrl(
  url,
  {
    fetchImpl = globalThis.fetch,
    maxAspectRatio = GOOGLE_CHAT_IMAGE_MAX_ASPECT_RATIO,
    maxBytes = GOOGLE_CHAT_IMAGE_MAX_BYTES,
    maxHeight = GOOGLE_CHAT_IMAGE_MAX_HEIGHT,
  } = {},
) {
  if (!String(url ?? '').startsWith('https://')) {
    return {
      valid: false,
      reason: 'non_https_url',
    }
  }

  if (!googleChatImageUrlHasAllowedOrigin(url)) {
    return {
      valid: false,
      reason: 'unsupported_origin',
    }
  }

  if (typeof fetchImpl !== 'function') {
    throw new Error('A fetch implementation is required to validate Google Chat image URLs.')
  }

  let response
  try {
    response = await fetchImpl(url, {
      method: 'GET',
    })
  } catch (error) {
    return {
      valid: false,
      reason: 'get_failed',
      error: error instanceof Error ? error.message : String(error),
    }
  }

  if (response?.status !== 200) {
    return {
      valid: false,
      reason: 'get_status',
      status: response?.status ?? null,
    }
  }

  const contentTypeHeader = response.headers?.get?.('content-type') ?? ''
  const contentType = contentTypeHeader.split(';')[0].trim().toLowerCase()
  if (!GOOGLE_CHAT_ALLOWED_IMAGE_CONTENT_TYPES.has(contentType)) {
    return {
      valid: false,
      reason: 'unsupported_content_type',
      contentType,
    }
  }

  const contentLengthHeader = response.headers?.get?.('content-length') ?? null
  const contentLength = contentLengthHeader ? Number.parseInt(contentLengthHeader, 10) : null
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return {
      valid: false,
      reason: 'too_large',
      contentType,
      sizeBytes: contentLength,
    }
  }

  const body = await readLimitedResponseBody(response, maxBytes)
  if (!body) {
    return {
      valid: false,
      reason: 'missing_body',
      contentType,
    }
  }

  const sizeBytes = body.buffer.byteLength
  if (body.tooLarge) {
    return {
      valid: false,
      reason: 'too_large',
      contentType,
      sizeBytes: Math.max(sizeBytes, maxBytes + 1),
    }
  }

  const { default: sharp } = await import('sharp')
  const metadata = await sharp(body.buffer).metadata()
  const width = Number(metadata.width)
  const height = Number(metadata.height)
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return {
      valid: false,
      reason: 'missing_dimensions',
      contentType,
      sizeBytes,
    }
  }

  if (height > maxHeight) {
    return {
      valid: false,
      reason: 'too_tall',
      contentType,
      height,
      maxHeight,
      sizeBytes,
      width,
    }
  }

  const aspectRatio = height / width
  if (aspectRatio > maxAspectRatio) {
    return {
      valid: false,
      reason: 'unsupported_aspect_ratio',
      aspectRatio,
      contentType,
      height,
      maxAspectRatio,
      sizeBytes,
      width,
    }
  }

  return {
    valid: true,
    aspectRatio,
    contentType,
    height,
    sizeBytes,
    width,
  }
}

export async function collectGoogleChatReleasePrVisuals({
  messageText,
  pullRequests,
  validateImageUrl = validateGoogleChatImageUrl,
  maxImages = GOOGLE_CHAT_IMAGE_LIMIT,
  maxItems = GOOGLE_CHAT_VISUAL_ITEM_LIMIT,
}) {
  const validVisuals = []

  for (const pullRequest of pullRequests ?? []) {
    if (!pullRequestHasMarkedReleaseVisual(pullRequest) && !pullRequestLooksVisual(pullRequest)) {
      continue
    }

    const validCandidates = []
    for (const candidate of releaseCandidatePoolForPullRequest(pullRequest)) {
      const validation = await validateImageUrl(candidate.url)
      if (!validation.valid) {
        continue
      }

      validCandidates.push({
        ...candidate,
        validation,
      })
    }

    for (const selectedCandidate of validCandidates) {
      validVisuals.push({
        prNumber: pullRequest.number,
        prTitle: truncateForModelInput(
          pullRequest.title || pullRequest.source_title || `PR #${pullRequest.number}`,
          96,
        ),
        prUrl: pullRequest.url,
        imageUrl: selectedCandidate.url,
        label: selectedCandidate.label,
        formFactor: selectedCandidate.formFactor,
        metadata: selectedCandidate.metadata ?? null,
        source: selectedCandidate.source,
        sourcePriority: selectedCandidate.sourcePriority,
        candidateIndex: selectedCandidate.index,
        contentType: selectedCandidate.validation.contentType,
        height: selectedCandidate.validation.height ?? selectedCandidate.metadata?.height ?? null,
        sizeBytes: selectedCandidate.validation.sizeBytes,
        width: selectedCandidate.validation.width ?? selectedCandidate.metadata?.width ?? null,
      })
    }
  }

  const visualItems = extractGoogleChatReleaseVisualItems(messageText, { maxItems })
  const selectedVisuals = assignVisualsToReleaseItems({
    visuals: validVisuals,
    visualItems,
    maxImages,
  })

  return {
    visualItems: (visualItems.length > 0 ? visualItems : buildFallbackReleaseVisualItems(selectedVisuals)).map(
      formatReleaseVisualItem,
    ),
    visuals: selectedVisuals.map(formatReleaseVisualResult),
  }
}

function buildNarrativeTexts(reference) {
  const issueTitles = (reference.issues ?? []).map((issue) => cleanNarrativeText(issue.title ?? ''))
  const issueProblemLines = (reference.issues ?? []).flatMap((issue) => issue.sections.problemStatement)
  const issueOutcomeLines = (reference.issues ?? []).flatMap((issue) => issue.sections.intendedOutcome)
  const issueQualityLines = (reference.issues ?? []).flatMap((issue) => [
    ...issue.sections.qualityCriteria,
    ...issue.sections.acceptanceCriteria,
  ])
  const issueFallbackLines = (reference.issues ?? []).flatMap((issue) => issue.sections.other)
  const prOverviewLines = reference.sections.overview
  const prChangeLines =
    reference.sections.whatChanged.length > 0 ? reference.sections.whatChanged : reference.sections.other

  const userFacingLines = dedupeTexts(
    normalizeNarrativeLines([
      cleanNarrativeText(reference.title ?? ''),
      ...issueTitles,
      ...issueProblemLines,
      ...issueOutcomeLines,
      ...prOverviewLines,
      ...prChangeLines,
      ...issueFallbackLines,
    ]),
  )

  const internalLines = dedupeTexts(
    [
      ...issueQualityLines,
      ...reference.sections.validation,
      ...reference.sections.screenshots,
      ...reference.sections.development,
    ]
      .map(stripInlineTechnicalNoise)
      .filter(Boolean),
  )

  return { userFacingLines, internalLines }
}

function enrichNarrativeReference(reference) {
  const sections = parseReferenceBodySections(reference.body ?? '')
  const issues = (reference.issues ?? []).map((issue) => ({
    ...issue,
    body: issue.body ?? '',
    sections: parseReferenceBodySections(issue.body ?? ''),
  }))
  const withSections = {
    ...reference,
    body: reference.body ?? '',
    sections,
    issues,
  }
  const { userFacingLines, internalLines } = buildNarrativeTexts(withSections)
  const referenceFingerprint = [
    cleanNarrativeText(reference.title ?? ''),
    ...userFacingLines,
    ...internalLines,
    ...issues.map((issue) => cleanNarrativeText(issue.title ?? '')),
  ]
    .join(' ')
    .toLowerCase()
  const isInternalMaintenance =
    INTERNAL_MAINTENANCE_KEYWORDS.some((keyword) => referenceFingerprint.includes(keyword)) &&
    userFacingLines.length === 0

  return {
    ...withSections,
    narrative: {
      userFacingLines,
      internalLines,
      qaRelevant: sections.validation.length > 0 || internalLines.length > 0,
      isInternalMaintenance,
    },
  }
}

function parseConventionalTypeFromText(text) {
  const match = String(text ?? '')
    .trim()
    .match(CONVENTIONAL_RE)
  return match?.[1]?.toLowerCase() ?? null
}

function classifyQualitySignals(lines) {
  const labels = []

  for (const line of lines ?? []) {
    const cleaned = collapseWhitespace(stripInlineTechnicalNoise(line))
    if (!cleaned) {
      continue
    }

    for (const rule of QUALITY_SIGNAL_RULES) {
      if (rule.pattern.test(cleaned)) {
        labels.push(rule.label)
      }
    }
  }

  return dedupeTexts(labels).slice(0, 4)
}

function isTechnicalNarrativeLine(text) {
  return TECHNICAL_NARRATIVE_LINE_PATTERNS.some((pattern) => pattern.test(text))
}

function normalizeNarrativeLines(lines, { excludeTechnicalNarrative = false } = {}) {
  const normalized = dedupeTexts(
    (lines ?? [])
      .map(stripInlineTechnicalNoise)
      .map(collapseWhitespace)
      .filter(Boolean)
      .filter((line) => !isTechnicalNoise(line)),
  )

  if (!excludeTechnicalNarrative) {
    return normalized
  }

  const filtered = normalized.filter((line) => !isTechnicalNarrativeLine(line))
  return filtered.length > 0 ? filtered : normalized
}

function buildFallbackReferencesFromBullets(bullets) {
  return bullets.filter(Boolean).map((bullet, index) =>
    enrichNarrativeReference({
      number: `fallback-${index}`,
      title: bullet,
      body: '',
      url: null,
      issues: [],
    }),
  )
}

function collectBulletsFromReleaseNotes(releaseNotes) {
  const sections = parseReleaseNotesSections(releaseNotes)
  const featureBullets = []
  const fixBullets = []

  for (const section of sections) {
    const sectionBullets = section.bullets.filter(Boolean).filter((bullet) => !isInternalBullet(bullet))
    if (sectionBullets.length === 0) {
      continue
    }

    if (FEATURE_SECTION_RE.test(section.title)) {
      featureBullets.push(...sectionBullets)
      continue
    }

    if (FIX_SECTION_RE.test(section.title)) {
      fixBullets.push(...sectionBullets)
      continue
    }

    fixBullets.push(...sectionBullets)
  }

  return { featureBullets, fixBullets }
}

function collectBulletsFromCommits(commits) {
  const featureBullets = []
  const fixBullets = []

  for (const commit of commits) {
    const cleaned = cleanReleaseNoteBullet(commit.subject ?? commit.description ?? '')
    if (!cleaned || isInternalBullet(cleaned)) {
      continue
    }

    if (commit.level === 'major' || commit.type === 'feat') {
      featureBullets.push(cleaned)
      continue
    }

    if (commit.type === 'docs' || commit.type === 'ci') {
      continue
    }

    fixBullets.push(cleaned)
  }

  return { featureBullets, fixBullets }
}

function extractPullRequestNumbersFromCommits(commits, max = MAX_RELEASE_PULL_REQUESTS) {
  const values = uniqueNumbersInOrder(commits.flatMap((commit) => extractPrNumbers(commit.subject ?? '')))
  return values.slice(0, max)
}

function extractPullRequestNumbersFromReleaseNotes(releaseNotes, max = MAX_RELEASE_PULL_REQUESTS) {
  const values = uniqueNumbersInOrder(extractPrNumbers(releaseNotes))
  return values.slice(0, max)
}

async function fetchPullRequestIssueReferences({
  repoSlug,
  prNumbers,
  cwd = process.cwd(),
  maxPullRequests = MAX_RELEASE_PULL_REQUESTS,
  maxIssuesPerPr = MAX_RELEASE_ISSUES_PER_PR,
  runJsonImpl = runJson,
}) {
  if (!repoSlug || prNumbers.length === 0) {
    return []
  }

  const selectedPrNumbers = prNumbers.slice(0, maxPullRequests)
  const { owner, name } = parseRepoOwnerAndName(repoSlug)
  const query = `
query($owner: String!, $name: String!, $number: Int!, $maxIssues: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      number
      title
      body
      url
      closingIssuesReferences(first: $maxIssues) {
        nodes {
          number
          title
          body
          url
        }
      }
    }
  }
}
`.trim()

  const references = []
  for (const prNumber of selectedPrNumbers) {
    let response = null
    try {
      response = runJsonImpl(
        'gh',
        [
          'api',
          'graphql',
          '--field',
          `query=${query}`,
          '--field',
          `owner=${owner}`,
          '--field',
          `name=${name}`,
          '--field',
          `number=${prNumber}`,
          '--field',
          `maxIssues=${maxIssuesPerPr}`,
        ],
        { cwd },
      )
    } catch {
      continue
    }

    const pullRequest = response?.data?.repository?.pullRequest ?? null
    if (!pullRequest) {
      continue
    }

    const issues = (pullRequest.closingIssuesReferences?.nodes ?? []).map((issue) => ({
      number: issue.number,
      title: issue.title,
      body: issue.body,
      url: issue.url,
    }))

    references.push(
      enrichNarrativeReference({
        number: pullRequest.number,
        title: pullRequest.title,
        body: pullRequest.body,
        url: pullRequest.url,
        issues,
      }),
    )
  }

  return references
}

/**
 * @param {{
 *   repoSlug: string
 *   commits: ReleaseCommit[]
 *   cwd?: string
 *   runJsonImpl?: typeof runJson
 * }} options
 */
export async function fetchAssociatedPullRequestIssueReferencesFromCommits({
  repoSlug,
  commits,
  cwd = process.cwd(),
  maxPullRequests = MAX_RELEASE_PULL_REQUESTS,
  maxAssociatedPullRequestsPerCommit = MAX_ASSOCIATED_PULL_REQUESTS_PER_COMMIT,
  maxIssuesPerPr = MAX_RELEASE_ISSUES_PER_PR,
  runJsonImpl = runJson,
}) {
  if (!repoSlug || commits.length === 0) {
    return []
  }

  const { owner, name } = parseRepoOwnerAndName(repoSlug)
  const query = `
query($owner: String!, $name: String!, $sha: GitObjectID!, $maxAssociatedPullRequests: Int!, $maxIssues: Int!) {
  repository(owner: $owner, name: $name) {
    object(oid: $sha) {
      ... on Commit {
        associatedPullRequests(first: $maxAssociatedPullRequests) {
          nodes {
            number
            title
            body
            url
            closingIssuesReferences(first: $maxIssues) {
              nodes {
                number
                title
                body
                url
              }
            }
          }
        }
      }
    }
  }
}
`.trim()

  const references = []
  const seen = new Set()

  for (const commit of commits) {
    if (references.length >= maxPullRequests || !commit.sha) {
      break
    }

    let response = null
    try {
      response = runJsonImpl(
        'gh',
        [
          'api',
          'graphql',
          '--field',
          `query=${query}`,
          '--field',
          `owner=${owner}`,
          '--field',
          `name=${name}`,
          '--field',
          `sha=${commit.sha}`,
          '--field',
          `maxAssociatedPullRequests=${maxAssociatedPullRequestsPerCommit}`,
          '--field',
          `maxIssues=${maxIssuesPerPr}`,
        ],
        { cwd },
      )
    } catch {
      continue
    }

    const associatedPullRequests = response?.data?.repository?.object?.associatedPullRequests?.nodes ?? []
    for (const pullRequest of associatedPullRequests) {
      if (!pullRequest?.number || seen.has(pullRequest.number)) {
        continue
      }

      seen.add(pullRequest.number)
      references.push(
        enrichNarrativeReference({
          number: pullRequest.number,
          title: pullRequest.title,
          body: pullRequest.body,
          url: pullRequest.url,
          issues: (pullRequest.closingIssuesReferences?.nodes ?? []).map((issue) => ({
            number: issue.number,
            title: issue.title,
            body: issue.body,
            url: issue.url,
          })),
        }),
      )

      if (references.length >= maxPullRequests) {
        break
      }
    }
  }

  if (references.length >= maxPullRequests) {
    return references
  }

  const fallbackPrNumbers = extractPullRequestNumbersFromCommits(commits, maxPullRequests * 2).filter(
    (prNumber) => !seen.has(prNumber),
  )
  if (fallbackPrNumbers.length === 0) {
    return references
  }

  const fallbackReferences = await fetchPullRequestIssueReferences({
    repoSlug,
    prNumbers: fallbackPrNumbers,
    cwd,
    maxPullRequests: maxPullRequests - references.length,
    maxIssuesPerPr,
    runJsonImpl,
  })

  for (const reference of fallbackReferences) {
    if (seen.has(reference.number)) {
      continue
    }

    seen.add(reference.number)
    references.push(reference)
  }

  return references
}

function isProductRelevantReference(reference) {
  if ((reference.issues ?? []).length > 0) {
    return true
  }

  if (reference.narrative.isInternalMaintenance) {
    return false
  }

  if (typeof reference.number !== 'number') {
    return true
  }

  const conventionalType = parseConventionalTypeFromText(reference.title ?? '')
  if (!conventionalType) {
    return true
  }

  if (PRODUCT_RELEVANT_TYPES.has(conventionalType)) {
    return true
  }

  return !FILTERED_INTERNAL_TYPES.has(conventionalType)
}

function visibleNarrativeReferences(references) {
  const visible = references.filter((reference) => !reference.narrative.isInternalMaintenance)
  const productRelevant = visible.filter(isProductRelevantReference)
  if (productRelevant.length > 0) {
    return productRelevant
  }

  return visible.length > 0 ? visible : references
}

function collapseWhitespace(text) {
  return String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}

function truncateForModelInput(text, maxLength = 320) {
  const cleaned = collapseWhitespace(text)
  if (cleaned.length <= maxLength) {
    return cleaned
  }

  return `${cleaned.slice(0, maxLength - 1).trimEnd()}…`
}

function selectSummaryLines(lines, { maxItems = 6, maxLength = 320 } = {}) {
  return dedupeTexts((lines ?? []).map((line) => collapseWhitespace(line)).filter(Boolean))
    .slice(0, maxItems)
    .map((line) => truncateForModelInput(line, maxLength))
}

function formatIssueForDrafting(issue) {
  return {
    number: issue.number,
    source_title: issue.title ?? '',
    title: truncateForModelInput(cleanNarrativeText(issue.title ?? ''), 180),
    url: issue.url ?? null,
    body_context: selectSummaryLines(issue.sections.other, { maxItems: 4 }),
    problem_statement: selectSummaryLines(issue.sections.problemStatement, { maxItems: 4 }),
    intended_outcome: selectSummaryLines(issue.sections.intendedOutcome, { maxItems: 4 }),
    quality_criteria: selectSummaryLines([...issue.sections.qualityCriteria, ...issue.sections.acceptanceCriteria], {
      maxItems: 4,
    }),
  }
}

function formatReferenceForDrafting(reference) {
  const overviewLines = reference.sections.overview.length > 0 ? reference.sections.overview : reference.sections.other
  const rawWhatChangedLines =
    reference.sections.whatChanged.length > 0 ? reference.sections.whatChanged : reference.narrative.userFacingLines
  const whatChangedLines = normalizeNarrativeLines(rawWhatChangedLines, {
    excludeTechnicalNarrative: true,
  })
  const userImpactSignals = normalizeNarrativeLines(reference.narrative.userFacingLines, {
    excludeTechnicalNarrative: true,
  })
  const qualitySignals = classifyQualitySignals([
    ...reference.sections.validation,
    ...reference.sections.screenshots,
    ...reference.sections.development,
    ...reference.narrative.internalLines,
  ])

  return {
    number: reference.number,
    source_title: reference.title ?? '',
    title: truncateForModelInput(cleanNarrativeText(reference.title ?? ''), 180),
    url: reference.url ?? null,
    body_context: selectSummaryLines(overviewLines, { maxItems: 4 }),
    what_changed: selectSummaryLines(whatChangedLines, { maxItems: 6 }),
    user_impact_signals: selectSummaryLines(userImpactSignals, { maxItems: 6 }),
    quality_and_validation: qualitySignals,
    visual_candidates: extractGoogleChatPrImageCandidates(reference.body ?? ''),
    linked_issues: (reference.issues ?? []).map(formatIssueForDrafting),
  }
}

function buildStakeholderAnnouncementSourceFromResolvedReferences({ releaseTag, releaseUrl, siteUrl, references }) {
  const visibleReferences = visibleNarrativeReferences(references)
  if (visibleReferences.length === 0) {
    throw new Error('No PR or issue content available to draft the release announcement.')
  }

  return {
    releaseTag,
    releaseUrl,
    siteUrl,
    draftingGuidance: {
      language: 'de',
      audience: 'non-technical colleagues',
      style: 'management-summary',
      itemCount: {
        minimum: 5,
        maximum: 7,
        useFewerOnlyForSmallReleases: true,
      },
      visualScope:
        'Visual replies show only selected key screenshots. Keep important non-visual release items in the text, and point readers to the release notes for the full change set.',
      targetStructure: [
        'Headline with the live version',
        'One short management summary line',
        'Five to seven grouped important changes in changelog style when the release scope supports it',
        'One or two concrete outcome sentences per numbered item',
        'Important non-visual changes even when no screenshot exists',
        'Optional note that visual highlights show only selected key screenshots, not every visual change',
        'Optional short confidence-building QA or stability note',
        'Links to the detailed release notes and live site',
      ],
    },
    pullRequests: visibleReferences.map(formatReferenceForDrafting),
  }
}

function formatRenderedSourceList(label, values) {
  if (!values || values.length === 0) {
    return []
  }

  return [`  ${label}: ${values.join(' | ')}`]
}

export function renderStakeholderAnnouncementSource(source) {
  const lines = [
    'Stakeholder announcement source:',
    `- Release: ${source.releaseTag}`,
    `- Release notes: ${source.releaseUrl}`,
    `- Live site: ${source.siteUrl}`,
    '- Goal: German management-summary for non-technical colleagues',
  ]
  const itemCount = source.draftingGuidance?.itemCount
  if (itemCount) {
    lines.push(
      `- Drafting guidance: ${itemCount.minimum}-${itemCount.maximum} release items; use fewer only for genuinely small releases.`,
    )
  }
  if (source.draftingGuidance?.visualScope) {
    lines.push(`- Visual scope: ${source.draftingGuidance.visualScope}`)
  }
  if (source.draftingGuidance?.targetStructure?.length > 0) {
    lines.push(`- Target structure: ${source.draftingGuidance.targetStructure.join(' | ')}`)
  }

  for (const pullRequest of source.pullRequests) {
    lines.push(`- PR #${pullRequest.number}: ${pullRequest.title}`)
    lines.push(...formatRenderedSourceList('Context', pullRequest.body_context))
    lines.push(...formatRenderedSourceList('What changed', pullRequest.what_changed))
    lines.push(...formatRenderedSourceList('User impact', pullRequest.user_impact_signals))
    lines.push(...formatRenderedSourceList('Quality signals', pullRequest.quality_and_validation))

    for (const issue of pullRequest.linked_issues) {
      lines.push(`  Linked issue #${issue.number}: ${issue.title}`)
      lines.push(...formatRenderedSourceList('    Problem', issue.problem_statement))
      lines.push(...formatRenderedSourceList('    Outcome', issue.intended_outcome))
      lines.push(...formatRenderedSourceList('    Quality criteria', issue.quality_criteria))
      lines.push(...formatRenderedSourceList('    Additional context', issue.body_context))
    }
  }

  return lines.join('\n')
}

export function renderUsedReleaseItems(source) {
  const lines = ['Verwendete PRs und Issues:']

  if (!source.pullRequests || source.pullRequests.length === 0) {
    lines.push('- Keine verwendeten PRs oder Issues gefunden.')
    return lines.join('\n')
  }

  for (const pullRequest of source.pullRequests) {
    const pullRequestTitle = pullRequest.source_title || pullRequest.title
    const pullRequestUrl = pullRequest.url ? ` (${pullRequest.url})` : ''
    if (!pullRequest.linked_issues || pullRequest.linked_issues.length === 0) {
      lines.push(`- PR #${pullRequest.number}${pullRequestUrl} (${pullRequestTitle})`)
      continue
    }

    for (const [index, issue] of (pullRequest.linked_issues ?? []).entries()) {
      const issueTitle = issue.source_title || issue.title
      const issueUrl = issue.url ? ` (${issue.url})` : ''
      const issueSegment = `Issue #${issue.number}${issueUrl} (${issueTitle})`
      if (index === 0) {
        lines.push(`- PR #${pullRequest.number}${pullRequestUrl} (${pullRequestTitle}) -> ${issueSegment}`)
        continue
      }

      lines.push(`  -> ${issueSegment}`)
    }
  }

  return lines.join('\n')
}

function summarizeCommitCounts(counts) {
  const parts = [
    `major=${counts.major}`,
    `minor=${counts.minor}`,
    `patch=${counts.patch}`,
    `non-conventional=${counts.nonConventional}`,
  ]

  if (typeof counts.linkedFeatureSignals === 'number') {
    parts.push(`linked-feature-signals=${counts.linkedFeatureSignals}`)
  }

  return parts.join(', ')
}

export function formatReleasePlanSummary(result) {
  const lines = [
    `Last tag: ${result.lastTag}`,
    `Technical next tag: ${result.nextTag}`,
    `Technical bump: ${result.bump}`,
    `Technical reason: ${result.bumpReason}`,
    `Commit count: ${result.commitCount}`,
    `Counts: ${summarizeCommitCounts(result.counts)}`,
  ]

  if (result.contextualAssessment) {
    lines.push(`Contextual next tag: ${result.contextualAssessment.nextTag}`)
    lines.push(`Contextual bump: ${result.contextualAssessment.bump}`)
    lines.push(`Contextual reason: ${result.contextualAssessment.reason}`)
  }

  lines.push(
    'Commits:',
    ...result.commits.map(
      (commit) =>
        `- ${commit.sha.slice(0, 7)} [${commit.level}] ${commit.subject}${commit.conventional ? '' : ' (patch fallback)'}`,
    ),
  )

  return lines.join('\n')
}

async function resolveNarrativeReferences({
  providedReferences = [],
  repoSlug,
  prNumbers = [],
  fallbackBullets = [],
  cwd = process.cwd(),
  runJsonImpl = runJson,
}) {
  const enrichedProvidedReferences = providedReferences.map((reference) =>
    reference.narrative && reference.sections && (reference.issues ?? []).every((issue) => issue.sections)
      ? reference
      : enrichNarrativeReference(reference),
  )
  if (enrichedProvidedReferences.length > 0) {
    return enrichedProvidedReferences
  }

  const fetchedReferences = await fetchPullRequestIssueReferences({
    repoSlug,
    prNumbers,
    cwd,
    runJsonImpl,
  })
  if (fetchedReferences.length > 0) {
    return fetchedReferences
  }

  return buildFallbackReferencesFromBullets(fallbackBullets)
}

/**
 * @param {{
 *   releaseTag: string
 *   releaseUrl: string
 *   siteUrl: string
 *   releaseNotes: string
 *   references?: NarrativePullRequestReference[]
 *   repoSlug?: string | null
 *   cwd?: string
 *   runJsonImpl?: typeof runJson
 * }} options
 */
export async function buildStakeholderAnnouncementSource({
  releaseTag,
  releaseUrl,
  siteUrl,
  releaseNotes,
  references = [],
  repoSlug = null,
  cwd = process.cwd(),
  runJsonImpl = runJson,
}) {
  const { featureBullets, fixBullets } = collectBulletsFromReleaseNotes(releaseNotes)
  const resolvedReferences = await resolveNarrativeReferences({
    providedReferences: references,
    repoSlug,
    prNumbers: extractPullRequestNumbersFromReleaseNotes(releaseNotes),
    fallbackBullets: [...featureBullets, ...fixBullets],
    cwd,
    runJsonImpl,
  })

  return buildStakeholderAnnouncementSourceFromResolvedReferences({
    releaseTag,
    releaseUrl,
    siteUrl,
    references: resolvedReferences,
  })
}

/**
 * @param {{
 *   releaseTag: string
 *   releaseUrl: string
 *   siteUrl: string
 *   commits: ReleaseCommit[]
 *   references?: NarrativePullRequestReference[]
 *   repoSlug?: string | null
 *   cwd?: string
 *   runJsonImpl?: typeof runJson
 * }} options
 */
export async function buildStakeholderAnnouncementSourceFromCommits({
  releaseTag,
  releaseUrl,
  siteUrl,
  commits,
  references = [],
  repoSlug = null,
  cwd = process.cwd(),
  runJsonImpl = runJson,
}) {
  const { featureBullets, fixBullets } = collectBulletsFromCommits(commits)
  const enrichedProvidedReferences = references.map((reference) =>
    reference.narrative && reference.sections && (reference.issues ?? []).every((issue) => issue.sections)
      ? reference
      : enrichNarrativeReference(reference),
  )
  const resolvedReferences =
    enrichedProvidedReferences.length > 0
      ? enrichedProvidedReferences
      : await fetchAssociatedPullRequestIssueReferencesFromCommits({
          repoSlug,
          commits,
          cwd,
          runJsonImpl,
        })

  return buildStakeholderAnnouncementSourceFromResolvedReferences({
    releaseTag,
    releaseUrl,
    siteUrl,
    references:
      resolvedReferences.length > 0
        ? resolvedReferences
        : buildFallbackReferencesFromBullets([...featureBullets, ...fixBullets]),
  })
}

/**
 * @param {{
 *   repoSlug: string
 *   releaseTag: string
 *   releaseUrl: string
 *   siteUrl: string
 *   commits: ReleaseCommit[]
 *   references?: NarrativePullRequestReference[]
 *   cwd?: string
 *   runJsonImpl?: typeof runJson
 * }} options
 */
export async function buildStakeholderAnnouncementSourceFromCommitsWithReferences({
  repoSlug,
  releaseTag,
  releaseUrl,
  siteUrl,
  commits,
  references = [],
  cwd = process.cwd(),
  runJsonImpl = runJson,
}) {
  return buildStakeholderAnnouncementSourceFromCommits({
    releaseTag,
    releaseUrl,
    siteUrl,
    commits,
    references,
    repoSlug,
    cwd,
    runJsonImpl,
  })
}

/**
 * @param {{
 *   repoSlug: string
 *   releaseTag: string
 *   releaseUrl: string
 *   siteUrl: string
 *   releaseNotes: string
 *   references?: NarrativePullRequestReference[]
 *   cwd?: string
 *   runJsonImpl?: typeof runJson
 * }} options
 */
export async function buildStakeholderAnnouncementSourceWithReferences({
  repoSlug,
  releaseTag,
  releaseUrl,
  siteUrl,
  releaseNotes,
  references = [],
  cwd = process.cwd(),
  runJsonImpl = runJson,
}) {
  return buildStakeholderAnnouncementSource({
    releaseTag,
    releaseUrl,
    siteUrl,
    releaseNotes,
    references,
    repoSlug,
    cwd,
    runJsonImpl,
  })
}

/**
 * @param {{
 *   repoSlug: string
 *   releasePlan: { nextTag: string, commits: ReleaseCommit[], references?: NarrativePullRequestReference[] }
 *   references?: NarrativePullRequestReference[]
 *   siteUrl: string
 *   googleChatSecretConfigured: boolean
 *   googleChatSecretName?: string
 *   chatWorkflowFile?: string
 *   chatWorkflowRef?: string
 *   releaseTargetCommitish?: string
 *   workflowFile?: string
 *   workflowRef?: string
 * }} options
 */
export async function buildDryRunPlan({
  repoSlug,
  releasePlan,
  references = [],
  siteUrl,
  googleChatSecretConfigured,
  googleChatSecretName = GOOGLE_CHAT_SECRET_NAME,
  chatWorkflowFile = GOOGLE_CHAT_WORKFLOW_FILE,
  chatWorkflowRef = 'main',
  releaseTargetCommitish = 'main',
  workflowFile = PRODUCTION_DEPLOY_WORKFLOW_FILE,
  workflowRef = releasePlan.nextTag,
}) {
  const releaseUrl = `https://github.com/${repoSlug}/releases/tag/${releasePlan.nextTag}`
  const resolvedReferences = references.length > 0 ? references : (releasePlan.references ?? [])
  const chatSource = await buildStakeholderAnnouncementSourceFromCommitsWithReferences({
    repoSlug,
    releaseTag: releasePlan.nextTag,
    releaseUrl,
    siteUrl,
    commits: releasePlan.commits,
    references: resolvedReferences,
  })

  return {
    release: {
      action: 'create GitHub release',
      endpoint: `repos/${repoSlug}/releases`,
      payload: buildReleasePayload({
        tag: releasePlan.nextTag,
        targetCommitish: releaseTargetCommitish,
      }),
      expectedUrl: releaseUrl,
    },
    deployment: {
      action: 'dispatch production workflow',
      workflowFile,
      endpoint: `repos/${repoSlug}/actions/workflows/${workflowFile}/dispatches`,
      payload: buildWorkflowDispatchPayload({ ref: workflowRef }),
      expectedRef: workflowRef,
    },
    chat: {
      action: 'draft Google Chat message in Codex, then dispatch the Google Chat send workflow after explicit approval',
      repositorySecretConfigured: googleChatSecretConfigured,
      repositorySecretName: googleChatSecretName,
      workflowFile: chatWorkflowFile,
      endpoint: `repos/${repoSlug}/actions/workflows/${chatWorkflowFile}/dispatches`,
      payloadTemplate: buildWorkflowDispatchPayload({
        ref: chatWorkflowRef,
        inputs: {
          message_payload_json: '<final Google Chat JSON payload from Codex>',
          release_tag: releasePlan.nextTag,
        },
      }),
      draftingRequired: true,
      source: chatSource,
    },
  }
}

function normalizeGoogleChatMessageText(text) {
  const normalizedText = String(text ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim()
  if (!normalizedText) {
    throw new Error('Missing Google Chat message text. Draft the final announcement in Codex and pass it explicitly.')
  }

  return normalizedText
}

function validateGoogleChatPayloadObject(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Google Chat message payload must be a JSON object.')
  }

  if (payload.text !== undefined && typeof payload.text !== 'string') {
    throw new Error('Google Chat message payload text must be a string when present.')
  }

  if (payload.cardsV2 !== undefined && !Array.isArray(payload.cardsV2)) {
    throw new Error('Google Chat message payload cardsV2 must be an array when present.')
  }

  if (typeof payload.text === 'string' && !payload.text.trim() && !payload.cardsV2) {
    throw new Error('Google Chat message payload needs non-empty text or cardsV2.')
  }
}

function buildGoogleChatCardId(releaseTag) {
  return `release-visuals-${String(releaseTag ?? 'untagged').replace(/[^a-z0-9_-]+/gi, '-')}`.slice(0, 64)
}

export function buildGoogleChatReleaseThreadKey(releaseTag) {
  return `findmydoc-release-${String(releaseTag ?? 'untagged').replace(/[^a-z0-9._-]+/gi, '-')}`.slice(0, 128)
}

function withGoogleChatThread(payload, threadKey) {
  if (!threadKey) {
    return payload
  }

  return {
    ...payload,
    thread: {
      ...(payload.thread ?? {}),
      threadKey,
    },
  }
}

function googleChatWebhookUrlForPayload(webhookUrl, payload) {
  if (!payload?.thread?.threadKey) {
    return webhookUrl
  }

  const url = new URL(webhookUrl)
  url.searchParams.set('messageReplyOption', 'REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD')
  return url.toString()
}

function groupVisualsByReleaseItem(visuals) {
  const groups = []
  const groupsByKey = new Map()

  for (const visual of visuals) {
    const key = `${visual.itemIndex}:${visual.itemTitle}`
    if (!groupsByKey.has(key)) {
      const group = {
        itemIndex: visual.itemIndex,
        itemTitle: visual.itemTitle,
        visuals: [],
      }
      groupsByKey.set(key, group)
      groups.push(group)
    }
    groupsByKey.get(key).visuals.push(visual)
  }

  return groups
}

function buildGoogleChatVisualPayload({ releaseTag, threadKey, visuals }) {
  const title = `Visuelle Highlights zu findmydoc ${releaseTag}`
  const visualGroups = groupVisualsByReleaseItem(visuals)

  return withGoogleChatThread(
    {
      text: title,
      cardsV2: [
        {
          cardId: buildGoogleChatCardId(releaseTag),
          card: {
            header: {
              title,
              subtitle: `${visualGroups.length} Release-Item${visualGroups.length === 1 ? '' : 's'}, ${
                visuals.length
              } Bild${visuals.length === 1 ? '' : 'er'}`,
            },
            sections: visualGroups.map((group) => ({
              header: `Zu ${group.itemIndex}. ${truncateForModelInput(group.itemTitle, 80)}`,
              widgets: group.visuals.flatMap((visual) => [
                {
                  decoratedText: {
                    text: `${visual.formFactor}: PR #${visual.prNumber} - ${truncateForModelInput(visual.label, 80)}`,
                    wrapText: true,
                  },
                },
                {
                  image: {
                    imageUrl: visual.imageUrl,
                    altText: visual.label,
                    onClick: {
                      openLink: {
                        url: visual.prUrl,
                      },
                    },
                  },
                },
                {
                  buttonList: {
                    buttons: [
                      {
                        text: 'PR öffnen',
                        onClick: {
                          openLink: {
                            url: visual.prUrl,
                          },
                        },
                      },
                    ],
                  },
                },
              ]),
            })),
          },
        },
      ],
    },
    threadKey,
  )
}

/**
 * @param {{
 *   text?: string
 *   payload?: Record<string, unknown> | null
 *   releaseTag?: string | null
 *   source?: { releaseTag?: string, pullRequests?: unknown[] } | null
 *   includePrImages?: boolean
 *   validateImageUrl?: Function
 * }} options
 */
export async function buildGoogleChatMessagePayload({
  text,
  payload = null,
  releaseTag = null,
  source = null,
  includePrImages = false,
  validateImageUrl = validateGoogleChatImageUrl,
}) {
  if (payload) {
    validateGoogleChatPayloadObject(payload)
    return {
      payload,
      visuals: [],
    }
  }

  const normalizedText = normalizeGoogleChatMessageText(text)
  if (!includePrImages) {
    return {
      payload: {
        text: normalizedText,
      },
      visuals: [],
    }
  }

  const resolvedReleaseTag = releaseTag ?? source?.releaseTag
  if (!resolvedReleaseTag) {
    throw new Error('--include-pr-images requires a release tag.')
  }

  if (!source?.pullRequests) {
    throw new Error('--include-pr-images requires release PR source context.')
  }

  const { visualItems, visuals } = await collectGoogleChatReleasePrVisuals({
    messageText: normalizedText,
    pullRequests: source.pullRequests,
    validateImageUrl,
  })
  if (visuals.length === 0) {
    return {
      payload: {
        text: normalizedText,
      },
      visualItems,
      visuals,
    }
  }

  const visualPayload = buildGoogleChatVisualPayload({
    releaseTag: resolvedReleaseTag,
    threadKey: buildGoogleChatReleaseThreadKey(resolvedReleaseTag),
    visuals,
  })
  validateGoogleChatPayloadObject(visualPayload)

  return {
    payload: visualPayload,
    visualItems,
    visuals,
  }
}

export async function buildGoogleChatReleaseMessageDispatches({
  text,
  releaseTag,
  source,
  includePrImages = false,
  validateImageUrl = validateGoogleChatImageUrl,
}) {
  const normalizedText = normalizeGoogleChatMessageText(text)
  if (!includePrImages) {
    return {
      dispatches: [
        {
          kind: 'message',
          payload: { text: normalizedText },
          visuals: [],
        },
      ],
      threadKey: null,
      visualItems: [],
      visuals: [],
    }
  }

  const threadKey = buildGoogleChatReleaseThreadKey(releaseTag ?? source?.releaseTag)
  const textPayload = withGoogleChatThread({ text: normalizedText }, threadKey)
  const { visualItems, visuals } = source?.pullRequests
    ? await collectGoogleChatReleasePrVisuals({
        messageText: normalizedText,
        pullRequests: source.pullRequests,
        validateImageUrl,
      })
    : { visualItems: [], visuals: [] }
  const dispatches = [
    {
      kind: 'message',
      payload: textPayload,
      visuals: [],
    },
  ]

  if (visuals.length > 0) {
    dispatches.push({
      kind: 'visuals',
      payload: buildGoogleChatVisualPayload({
        releaseTag: releaseTag ?? source?.releaseTag,
        threadKey,
        visuals,
      }),
      visuals,
    })
  }

  return {
    dispatches,
    threadKey,
    visualItems,
    visuals,
  }
}

/**
 * @param {{
 *   text?: string
 *   payload?: Record<string, unknown>
 *   webhookUrl?: string
 *   dryRun?: boolean
 *   releaseTag?: string
 *   source?: unknown
 *   includePrImages?: boolean
 *   validateImageUrl?: Function
 * }} options
 */
export async function sendGoogleChatMessage(options) {
  const { dryRun = false, webhookUrl } = options
  const { dispatches, threadKey, visualItems, visuals } = await buildGoogleChatReleaseMessageDispatches(options)

  if (dryRun) {
    return {
      dispatches,
      payload: dispatches[0]?.payload ?? null,
      threadKey,
      visualItems,
      visuals,
      responseStatus: null,
    }
  }

  if (!webhookUrl) {
    throw new Error('Missing Google Chat webhook URL for direct send.')
  }

  const statuses = []
  for (const dispatch of dispatches) {
    const response = await fetch(googleChatWebhookUrlForPayload(webhookUrl, dispatch.payload), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify(dispatch.payload),
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`Google Chat webhook returned ${response.status}: ${body}`)
    }
    statuses.push(response.status)
  }

  return {
    dispatches,
    payload: dispatches[0]?.payload ?? null,
    responseStatus: statuses.at(-1) ?? null,
    responseStatuses: statuses,
    threadKey,
    visualItems,
    visuals,
  }
}
