#!/usr/bin/env node

import {
  determineNextReleaseWithReferences,
  formatReleasePlanSummary,
  getLatestReleaseTag,
  getRepoSlug,
} from './lib.mjs'

try {
  const jsonMode = process.argv.includes('--json')
  const lastTag = getLatestReleaseTag()

  if (!lastTag) {
    throw new Error('No merged semantic version tag matching v*.*.* was found.')
  }

  const result = await determineNextReleaseWithReferences({
    lastTag,
    repoSlug: getRepoSlug(),
  })

  if (jsonMode) {
    console.log(JSON.stringify(result, null, 2))
  } else {
    console.log(formatReleasePlanSummary(result))
  }
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
