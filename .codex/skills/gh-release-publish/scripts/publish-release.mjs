#!/usr/bin/env node

import { createInterface } from 'node:readline/promises'
import process from 'node:process'
import {
  buildDryRunPlan,
  buildStakeholderMessageFromCommits,
  createRelease,
  determineNextRelease,
  dispatchWorkflow,
  ensureGhAuth,
  formatChatOverridesForShell,
  fetchMainAndTags,
  hasChatMessageOverrides,
  getCurrentBranch,
  getGitStatusPorcelain,
  getHeadSha,
  getLatestReleaseTag,
  getReleaseByTag,
  parseChatMessageOverrides,
  getRepoSlug,
  releaseExists,
  sendGoogleChatMessage,
  tagExists,
  waitForWorkflowRun,
} from './lib.mjs'

function summarizeReleasePlan(result) {
  return [
    `Last tag: ${result.lastTag}`,
    `Next tag: ${result.nextTag}`,
    `Recommended bump: ${result.bump}`,
    `Reason: ${result.bumpReason}`,
    `Commit count: ${result.commitCount}`,
    'Commits:',
    ...result.commits.map(
      (commit) =>
        `- ${commit.sha.slice(0, 7)} [${commit.level}] ${commit.subject}${commit.conventional ? '' : ' (patch fallback)'}`,
    ),
  ].join('\n')
}

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
  console.log('Planned GitHub release action:')
  console.log(`- Endpoint: ${dryRunPlan.release.endpoint}`)
  console.log(`- Expected release URL: ${dryRunPlan.release.expectedUrl}`)
  console.log(`- Payload: ${JSON.stringify(dryRunPlan.release.payload, null, 2)}`)

  console.log('Planned production workflow dispatch:')
  console.log(`- Endpoint: ${dryRunPlan.deployment.endpoint}`)
  console.log(`- Workflow file: ${dryRunPlan.deployment.workflowFile}`)
  console.log(`- Payload: ${JSON.stringify(dryRunPlan.deployment.payload, null, 2)}`)

  console.log('Planned Google Chat message:')
  console.log(`- Webhook configured: ${dryRunPlan.chat.webhookConfigured ? 'yes' : 'no'}`)
  console.log(dryRunPlan.chat.payload.text)
}

async function main() {
  const { dryRun, dryRunJson, execute } = ensureExactFlagSelection()
  const siteUrl = process.env.GOOGLE_CHAT_SITE_URL ?? 'https://findmydoc.eu'
  const webhookUrl = process.env.GOOGLE_CHAT_WEBHOOK_URL ?? null
  const repoSlug = getRepoSlug()
  const chatOverrides = parseChatMessageOverrides(process.argv)

  ensureGhAuth()
  fetchMainAndTags()

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

  const releasePlan = determineNextRelease(lastTag)
  if (tagExists(releasePlan.nextTag)) {
    throw new Error(`Tag ${releasePlan.nextTag} already exists.`)
  }

  if (releaseExists(repoSlug, releasePlan.nextTag)) {
    throw new Error(`Release ${releasePlan.nextTag} already exists on GitHub.`)
  }

  if (execute && !webhookUrl) {
    throw new Error('GOOGLE_CHAT_WEBHOOK_URL is required for --execute.')
  }

  console.log(summarizeReleasePlan(releasePlan))
  console.log('Planned Google Chat message preview (based on current commit history):')
  console.log(
    buildStakeholderMessageFromCommits({
      releaseTag: releasePlan.nextTag,
      releaseUrl: `https://github.com/${repoSlug}/releases/tag/${releasePlan.nextTag}`,
      siteUrl,
      commits: releasePlan.commits,
      overrides: chatOverrides,
    }),
  )

  if (dryRun || dryRunJson) {
    const dryRunPlan = await buildDryRunPlan({
      repoSlug,
      releasePlan,
      siteUrl,
      webhookConfigured: Boolean(webhookUrl),
      chatOverrides,
    })

    if (dryRunJson) {
      console.log(JSON.stringify(dryRunPlan, null, 2))
    } else {
      printDryRunPlan(dryRunPlan)
      console.log('Dry run only: no GitHub release, workflow dispatch, or Google Chat message sent.')
    }
    return
  }

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

  const preview = await sendGoogleChatMessage({
    releaseTag: releasePlan.nextTag,
    releaseUrl,
    siteUrl,
    releaseNotes: createdRelease.body,
    webhookUrl,
    dryRun: true,
    overrides: chatOverrides,
  })
  console.log('Google Chat message preview:')
  console.log(preview.payload.text)

  let shouldSend = false
  if (process.stdin.isTTY && process.stdout.isTTY) {
    const readline = createInterface({
      input: process.stdin,
      output: process.stdout,
    })
    const answer = await readline.question('Send this Google Chat message now? [y/N] ')
    readline.close()
    shouldSend = /^y(es)?$/i.test(answer.trim())
  }

  if (!shouldSend) {
    console.log('Google Chat message was not sent.')
    const overrideFlags = formatChatOverridesForShell(chatOverrides)
    console.log(
      `After approval, send it with: node .codex/skills/gh-release-publish/scripts/send-google-chat-message.mjs --release-tag ${releasePlan.nextTag} --release-url ${releaseUrl} --site-url ${siteUrl}${overrideFlags ? ` ${overrideFlags}` : ''} --yes`,
    )
    return
  }

  await sendGoogleChatMessage({
    releaseTag: releasePlan.nextTag,
    releaseUrl,
    siteUrl,
    releaseNotes: createdRelease.body,
    webhookUrl,
    overrides: chatOverrides,
  })
  console.log('Google Chat notification sent.')
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
