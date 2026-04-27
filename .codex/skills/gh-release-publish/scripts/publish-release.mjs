#!/usr/bin/env node

import process from 'node:process'
import {
  buildDryRunPlan,
  buildStakeholderAnnouncementSourceFromCommitsWithReferences,
  buildStakeholderAnnouncementSourceWithReferences,
  createRelease,
  determineNextReleaseWithReferences,
  dispatchWorkflow,
  ensureGhAuth,
  fetchMainAndTags,
  formatReleasePlanSummary,
  getCurrentBranch,
  getGitStatusPorcelain,
  getHeadSha,
  getLatestReleaseTag,
  getReleaseByTag,
  getRepoSlug,
  GOOGLE_CHAT_SECRET_NAME,
  GOOGLE_CHAT_WORKFLOW_FILE,
  repositorySecretExists,
  renderUsedReleaseItems,
  renderStakeholderAnnouncementSource,
  releaseExists,
  tagExists,
  waitForWorkflowRun,
} from './lib.mjs'

function ensureExactFlagSelection() {
  const dryRun = process.argv.includes('--dry-run')
  const dryRunJson = process.argv.includes('--dry-run-json')
  const execute = process.argv.includes('--execute')
  if (Number(dryRun) + Number(dryRunJson) + Number(execute) !== 1) {
    throw new Error('Use exactly one of --dry-run, --dry-run-json, or --execute.')
  }
  return { dryRun, dryRunJson, execute }
}

function printDryRunPlan(dryRunPlan) {
  console.log(renderUsedReleaseItems(dryRunPlan.chat.source))
  console.log(renderStakeholderAnnouncementSource(dryRunPlan.chat.source))

  console.log('Planned GitHub release action:')
  console.log(`- Endpoint: ${dryRunPlan.release.endpoint}`)
  console.log(`- Expected release URL: ${dryRunPlan.release.expectedUrl}`)
  console.log(`- Payload: ${JSON.stringify(dryRunPlan.release.payload, null, 2)}`)

  console.log('Planned production workflow dispatch:')
  console.log(`- Endpoint: ${dryRunPlan.deployment.endpoint}`)
  console.log(`- Workflow file: ${dryRunPlan.deployment.workflowFile}`)
  console.log(`- Payload: ${JSON.stringify(dryRunPlan.deployment.payload, null, 2)}`)

  console.log('Planned Google Chat drafting handoff:')
  console.log(
    `- Repository secret ${dryRunPlan.chat.repositorySecretName} configured: ${dryRunPlan.chat.repositorySecretConfigured ? 'yes' : 'no'}`,
  )
  console.log(`- Send workflow: ${dryRunPlan.chat.workflowFile}`)
  console.log(`- Endpoint: ${dryRunPlan.chat.endpoint}`)
  console.log(`- Payload template: ${JSON.stringify(dryRunPlan.chat.payloadTemplate, null, 2)}`)
  console.log('- Final Google Chat text must be drafted in Codex from the source above.')
  if (!dryRunPlan.chat.repositorySecretConfigured) {
    console.log(
      `- Setup command: gh secret set ${dryRunPlan.chat.repositorySecretName} --repo findmydoc-platform/website`,
    )
  }
}

async function main() {
  const { dryRun, dryRunJson } = ensureExactFlagSelection()
  const siteUrl = process.env.GOOGLE_CHAT_SITE_URL ?? 'https://findmydoc.eu'
  const repoSlug = getRepoSlug()

  ensureGhAuth()
  fetchMainAndTags()
  const googleChatSecretConfigured = repositorySecretExists({
    repoSlug,
    secretName: GOOGLE_CHAT_SECRET_NAME,
  })

  const branch = getCurrentBranch()
  if (branch !== 'main') {
    throw new Error(`Releases must be created from main. Current branch: ${branch}`)
  }

  const status = getGitStatusPorcelain()
  if (status) {
    throw new Error('Working tree must be clean before publishing a release.')
  }

  const localHead = getHeadSha('HEAD')
  const remoteHead = getHeadSha('origin/main')
  if (localHead !== remoteHead) {
    throw new Error('HEAD must match origin/main before publishing a release.')
  }

  const lastTag = getLatestReleaseTag()
  if (!lastTag) {
    throw new Error('No merged semantic version tag matching v*.*.* was found.')
  }

  const releasePlan = await determineNextReleaseWithReferences({
    lastTag,
    repoSlug,
  })
  if (tagExists(releasePlan.nextTag)) {
    throw new Error(`Tag ${releasePlan.nextTag} already exists.`)
  }

  if (releaseExists(repoSlug, releasePlan.nextTag)) {
    throw new Error(`Release ${releasePlan.nextTag} already exists on GitHub.`)
  }

  if (dryRun || dryRunJson) {
    const dryRunPlan = await buildDryRunPlan({
      repoSlug,
      siteUrl,
      releasePlan,
      googleChatSecretConfigured,
      googleChatSecretName: GOOGLE_CHAT_SECRET_NAME,
      chatWorkflowFile: GOOGLE_CHAT_WORKFLOW_FILE,
    })

    if (dryRunJson) {
      console.log(JSON.stringify(dryRunPlan, null, 2))
    } else {
      console.log(formatReleasePlanSummary(releasePlan))
      printDryRunPlan(dryRunPlan)
      console.log('Dry run only: no GitHub release, workflow dispatch, or Google Chat message sent.')
    }
    return
  }

  console.log(formatReleasePlanSummary(releasePlan))
  const preReleaseAnnouncementSource = await buildStakeholderAnnouncementSourceFromCommitsWithReferences({
    repoSlug,
    releaseTag: releasePlan.nextTag,
    releaseUrl: `https://github.com/${repoSlug}/releases/tag/${releasePlan.nextTag}`,
    siteUrl,
    commits: releasePlan.commits,
    references: releasePlan.references ?? [],
  })
  console.log(renderUsedReleaseItems(preReleaseAnnouncementSource))
  console.log(renderStakeholderAnnouncementSource(preReleaseAnnouncementSource))

  const release = createRelease({
    repoSlug,
    tag: releasePlan.nextTag,
    targetCommitish: 'main',
  })
  const releaseUrl = release.html_url ?? release.url
  console.log(`Release created: ${releaseUrl}`)

  const dispatch = dispatchWorkflow({
    repoSlug,
    workflowFile: 'deploy.yml',
    ref: 'main',
  })
  console.log('Production workflow dispatched.')

  const workflowRun = await waitForWorkflowRun({
    repoSlug,
    workflowFile: 'deploy.yml',
    ref: 'main',
    headSha: localHead,
    dispatchedAt: dispatch.dispatchedAt,
  })
  console.log(`Production workflow succeeded: ${workflowRun.html_url}`)

  const createdRelease = getReleaseByTag(repoSlug, releasePlan.nextTag)
  if (!createdRelease.body?.trim()) {
    throw new Error(`Release ${releasePlan.nextTag} has no generated release notes to announce.`)
  }

  const announcementSource = await buildStakeholderAnnouncementSourceWithReferences({
    repoSlug,
    releaseTag: releasePlan.nextTag,
    releaseUrl,
    siteUrl,
    releaseNotes: createdRelease.body,
  })
  console.log(renderUsedReleaseItems(announcementSource))
  console.log(renderStakeholderAnnouncementSource(announcementSource))

  if (googleChatSecretConfigured) {
    console.log(
      `Draft the final German Google Chat message in Codex from the source above, then send it explicitly through ${GOOGLE_CHAT_WORKFLOW_FILE}.`,
    )
    console.log(
      `Send command: node .codex/skills/gh-release-publish/scripts/send-google-chat-message.mjs --release-tag ${releasePlan.nextTag} --message-file <path> --yes`,
    )
    return
  }

  console.log(
    `${GOOGLE_CHAT_SECRET_NAME} repository secret is not configured. Release and deploy are complete; set the secret before sending the Google Chat announcement with: gh secret set ${GOOGLE_CHAT_SECRET_NAME} --repo ${repoSlug}`,
  )
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
