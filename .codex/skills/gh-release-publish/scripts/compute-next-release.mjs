#!/usr/bin/env node

import {
  determineNextReleaseWithReferences,
  fetchMainAndTags,
  formatReleasePlanSummary,
  getLatestReleaseTag,
  getRepoSlug,
} from './lib.mjs'

const RELEASE_REF = 'origin/main'

try {
  const jsonMode = process.argv.includes('--json')
  fetchMainAndTags()
  const lastTag = getLatestReleaseTag(RELEASE_REF)

  if (!lastTag) {
    throw new Error('No merged semantic version tag matching v*.*.* was found.')
  }

  const result = await determineNextReleaseWithReferences({
    lastTag,
    ref: RELEASE_REF,
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
