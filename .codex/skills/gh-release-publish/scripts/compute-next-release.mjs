#!/usr/bin/env node

import { determineNextRelease, getLatestReleaseTag } from './lib.mjs'

function formatHumanSummary(result) {
  const lines = [
    `Last tag: ${result.lastTag}`,
    `Next tag: ${result.nextTag}`,
    `Recommended bump: ${result.bump}`,
    `Reason: ${result.bumpReason}`,
    `Commit count: ${result.commitCount}`,
    `Counts: major=${result.counts.major}, minor=${result.counts.minor}, patch=${result.counts.patch}, non-conventional=${result.counts.nonConventional}`,
    'Commits:',
    ...result.commits.map(
      (commit) =>
        `- ${commit.sha.slice(0, 7)} [${commit.level}] ${commit.subject}${commit.conventional ? '' : ' (patch fallback)'}`,
    ),
  ]

  return lines.join('\n')
}

try {
  const jsonMode = process.argv.includes('--json')
  const lastTag = getLatestReleaseTag()

  if (!lastTag) {
    throw new Error('No merged semantic version tag matching v*.*.* was found.')
  }

  const result = determineNextRelease(lastTag)

  if (jsonMode) {
    console.log(JSON.stringify(result, null, 2))
  } else {
    console.log(formatHumanSummary(result))
  }
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
