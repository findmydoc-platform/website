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

const THEME_DEFINITIONS = [
  {
    key: 'privacy',
    keywords: ['consent', 'cookie', 'privacy', 'tracking', 'preferences'],
    featureLine: 'Datenschutz- und Einwilligungsabläufe wurden klarer und verlässlicher umgesetzt.',
    improvementLine: 'Auch Datenschutz- und Einwilligungsdetails wurden robuster nachgeschärft.',
  },
  {
    key: 'search',
    keywords: ['search', 'find', 'navigation', 'route', 'link', 'href', 'sitemap'],
    featureLine: 'Auffindbarkeit, Navigation und Linkverhalten wurden für Nutzer:innen verbessert.',
    improvementLine: 'Zusätzlich wurden Navigation, Links und Auffindbarkeit im Detail verbessert.',
  },
  {
    key: 'ui',
    keywords: ['brand', 'card', 'design', 'footer', 'frontend', 'hero', 'icon', 'layout', 'page', 'ui', 'visual'],
    featureLine: 'Die Oberfläche wurde an wichtigen Stellen klarer und konsistenter verbessert.',
    improvementLine: 'Es gab weiteren Feinschliff bei Oberfläche, Darstellung und kleineren UX-Details.',
  },
  {
    key: 'content',
    keywords: ['admin', 'author', 'collection', 'content', 'copy', 'editor', 'media', 'payload', 'post'],
    featureLine: 'Die Pflege von Inhalten und Verwaltungsdaten wurde weiter vereinfacht.',
    improvementLine: 'Für interne Teams wurden kleinere Verbesserungen in Pflege- und Admin-Abläufen ausgerollt.',
  },
  {
    key: 'forms',
    keywords: ['booking', 'contact', 'form', 'input', 'lead', 'request', 'submit'],
    featureLine: 'Anfragen und Eingaben wurden robuster und verständlicher gestaltet.',
    improvementLine: 'Auch rund um Eingaben, Formulare und Rückmeldungen gab es gezielte Stabilitätsverbesserungen.',
  },
  {
    key: 'reliability',
    keywords: ['fallback', 'filter', 'loading', 'parse', 'performance', 'reliable', 'stability', 'trim', 'whitespace'],
    featureLine: 'Zentrale Abläufe wurden verlässlicher und im Alltag spürbar sauberer gemacht.',
    improvementLine: 'Darüber hinaus wurden mehrere Stabilitäts- und Qualitätsverbesserungen gebündelt veröffentlicht.',
  },
]

function defaultHeadline(releaseTag) {
  return `*findmydoc ${releaseTag} ist live*`
}

function defaultSummary(hasFeatures) {
  return hasFeatures
    ? 'Dieses Release bringt vor allem sichtbare Verbesserungen für Nutzung, Inhalte und Verlässlichkeit.'
    : 'Dieses Release konzentriert sich vor allem auf Stabilität, Klarheit und Feinschliff im Alltag.'
}

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

export function getLatestReleaseTag(cwd = process.cwd()) {
  const { stdout } = run('git', ['tag', '--merged', 'HEAD', '--sort=-v:refname', '--list', 'v*.*.*'], { cwd })
  const tag = stdout
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean)
  return tag ?? null
}

export function getCommitRange(lastTag) {
  return `${lastTag}..HEAD`
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

export function getCommitsSinceTag(lastTag, cwd = process.cwd()) {
  const format = '%H%x1f%s%x1f%B%x1e'
  const { stdout } = run('git', ['log', getCommitRange(lastTag), `--format=${format}`], {
    cwd,
  })

  return stdout
    .split('\u001e')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map(parseCommitRecord)
}

export function determineNextRelease(lastTag, cwd = process.cwd()) {
  const commits = getCommitsSinceTag(lastTag, cwd)
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

export function dispatchWorkflow({ cwd = process.cwd(), repoSlug, workflowFile, ref = 'main' }) {
  const dispatchedAt = new Date().toISOString()
  const payload = buildWorkflowDispatchPayload({ ref })
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
  }
}

export function buildWorkflowDispatchPayload({ ref = 'main' }) {
  return { ref }
}

export async function waitForWorkflowRun({
  cwd = process.cwd(),
  repoSlug,
  workflowFile,
  ref = 'main',
  headSha,
  dispatchedAt,
  timeoutSeconds = Number(process.env.GH_RELEASE_PUBLISH_RUN_TIMEOUT_SECONDS ?? 1800),
  pollIntervalSeconds = Number(process.env.GH_RELEASE_PUBLISH_POLL_INTERVAL_SECONDS ?? 10),
}) {
  const startedAt = Date.now()
  let runInfo = null

  while (Date.now() - startedAt < timeoutSeconds * 1000) {
    const runs = runJson(
      'gh',
      [
        'api',
        `repos/${repoSlug}/actions/workflows/${workflowFile}/runs?event=workflow_dispatch&branch=${ref}&per_page=10`,
      ],
      { cwd },
    )

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
    .replace(/\s+by @[A-Za-z0-9_-]+ in #\d+$/g, '')
    .replace(/\s+in https:\/\/github\.com\/\S+$/g, '')
    .replace(/\s+\(#\d+\)$/g, '')
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

export function detectTheme(text) {
  const normalized = text.toLowerCase()
  for (const theme of THEME_DEFINITIONS) {
    if (theme.keywords.some((keyword) => normalized.includes(keyword))) {
      return theme.key
    }
  }
  return 'generic'
}

export function isInternalBullet(text) {
  const normalized = text.toLowerCase()
  return INTERNAL_KEYWORDS.some((keyword) => normalized.includes(keyword))
}

function themeLine(themeKey, variant) {
  const theme = THEME_DEFINITIONS.find((entry) => entry.key === themeKey)
  if (!theme) {
    return variant === 'feature'
      ? 'Mehrere sichtbare Produktverbesserungen wurden gebündelt ausgeliefert.'
      : 'Darüber hinaus wurden mehrere kleinere Qualitäts- und Stabilitätsverbesserungen ausgerollt.'
  }

  return variant === 'feature' ? theme.featureLine : theme.improvementLine
}

function rankThemes(bullets) {
  const counts = new Map()

  for (const bullet of bullets) {
    const themeKey = detectTheme(bullet)
    counts.set(themeKey, (counts.get(themeKey) ?? 0) + 1)
  }

  return [...counts.entries()].sort((left, right) => right[1] - left[1]).map(([themeKey]) => themeKey)
}

function normalizeAddedLine(line) {
  const trimmed = line.trim()
  if (!trimmed) {
    return null
  }

  if (trimmed.startsWith('-') || trimmed.startsWith('*') || trimmed.startsWith('<')) {
    return trimmed
  }

  return `- ${trimmed}`
}

function applyContentOverrides(lines, overrides) {
  const contentLines = [...lines]

  if (overrides.headline) {
    contentLines[0] = overrides.headline
  }

  if (overrides.summary) {
    if (contentLines.length < 2) {
      contentLines.push(overrides.summary)
    } else {
      contentLines[1] = overrides.summary
    }
  }

  if (overrides.removePatterns?.length) {
    const normalizedPatterns = overrides.removePatterns.map((pattern) => pattern.toLowerCase())
    const pinnedLines = contentLines.slice(0, 2)
    const removableLines = contentLines
      .slice(2)
      .filter((line) => !normalizedPatterns.some((pattern) => line.toLowerCase().includes(pattern)))
    contentLines.splice(0, contentLines.length, ...pinnedLines, ...removableLines)
  }

  for (const line of overrides.addLines ?? []) {
    const normalizedLine = normalizeAddedLine(line)
    if (normalizedLine) {
      contentLines.push(normalizedLine)
    }
  }

  return contentLines
}

function buildStakeholderMessageFromBullets({
  releaseTag,
  releaseUrl,
  siteUrl,
  featureBullets,
  fixBullets,
  overrides,
}) {
  const lines = [defaultHeadline(releaseTag), defaultSummary(featureBullets.length > 0)]

  const featureThemes = rankThemes(featureBullets).slice(0, 3)
  for (const themeKey of featureThemes) {
    lines.push(`- ${themeLine(themeKey, 'feature')}`)
  }

  const fixThemes = rankThemes(fixBullets).filter((themeKey) => !featureThemes.includes(themeKey))
  if (fixBullets.length > 0) {
    const improvementLines = fixThemes.slice(0, featureThemes.length > 0 ? 1 : 2)
    for (const themeKey of improvementLines) {
      lines.push(`- ${themeLine(themeKey, 'improvement')}`)
    }

    if (improvementLines.length === 0) {
      lines.push(`- ${themeLine('generic', 'improvement')}`)
    }
  }

  while (lines.length < 4) {
    lines.push('- Weitere kleinere Verbesserungen wurden gebündelt mit ausgerollt.')
  }

  if (lines.length > 8) {
    lines.splice(8)
  }

  const overriddenLines = applyContentOverrides(lines, overrides)
  overriddenLines.push(`<${releaseUrl}|Release Notes>`)
  overriddenLines.push(`<${siteUrl}|findmydoc öffnen>`)

  return overriddenLines.join('\n')
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

export function buildStakeholderMessage({ releaseTag, releaseUrl, siteUrl, releaseNotes, overrides = {} }) {
  const { featureBullets, fixBullets } = collectBulletsFromReleaseNotes(releaseNotes)
  return buildStakeholderMessageFromBullets({
    releaseTag,
    releaseUrl,
    siteUrl,
    featureBullets,
    fixBullets,
    overrides,
  })
}

export function buildStakeholderMessageFromCommits({ releaseTag, releaseUrl, siteUrl, commits, overrides = {} }) {
  const { featureBullets, fixBullets } = collectBulletsFromCommits(commits)
  return buildStakeholderMessageFromBullets({
    releaseTag,
    releaseUrl,
    siteUrl,
    featureBullets,
    fixBullets,
    overrides,
  })
}

export async function buildDryRunPlan({
  repoSlug,
  releasePlan,
  siteUrl,
  webhookConfigured,
  chatOverrides = {},
  workflowFile = 'deploy.yml',
  workflowRef = 'main',
}) {
  const releaseUrl = `https://github.com/${repoSlug}/releases/tag/${releasePlan.nextTag}`
  const chatPreview = buildStakeholderMessageFromCommits({
    releaseTag: releasePlan.nextTag,
    releaseUrl,
    siteUrl,
    commits: releasePlan.commits,
    overrides: chatOverrides,
  })

  return {
    release: {
      action: 'create GitHub release',
      endpoint: `repos/${repoSlug}/releases`,
      payload: buildReleasePayload({
        tag: releasePlan.nextTag,
        targetCommitish: 'main',
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
      action: 'send Google Chat webhook message after explicit approval',
      webhookConfigured,
      endpoint: webhookConfigured ? 'configured GOOGLE_CHAT_WEBHOOK_URL' : 'missing GOOGLE_CHAT_WEBHOOK_URL',
      payload: {
        text: chatPreview,
      },
    },
  }
}

export async function sendGoogleChatMessage({
  releaseTag,
  releaseUrl,
  siteUrl,
  releaseNotes,
  webhookUrl,
  dryRun = false,
  overrides = {},
}) {
  const text = buildStakeholderMessage({
    releaseTag,
    releaseUrl,
    siteUrl,
    releaseNotes,
    overrides,
  })
  const payload = { text }

  if (dryRun) {
    return {
      payload,
      responseStatus: null,
    }
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Google Chat webhook returned ${response.status}: ${body}`)
  }

  return {
    payload,
    responseStatus: response.status,
  }
}
