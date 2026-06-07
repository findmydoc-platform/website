#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import process from 'node:process'
import {
  buildWorkflowDispatchPayload,
  buildStakeholderAnnouncementSourceWithReferences,
  dispatchWorkflow,
  ensureGhAuth,
  fetchMainAndTags,
  getReleaseByTag,
  getRepoSlug,
  getHeadSha,
  GOOGLE_CHAT_SECRET_NAME,
  GOOGLE_CHAT_WORKFLOW_FILE,
  readArgValue,
  repositorySecretExists,
  renderStakeholderAnnouncementSource,
  renderUsedReleaseItems,
  sendGoogleChatMessage,
  waitForWorkflowRun,
} from './lib.mjs'

try {
  const releaseTag = readArgValue(process.argv, '--release-tag')
  const releaseUrlArg = readArgValue(process.argv, '--release-url')
  const siteUrl = readArgValue(process.argv, '--site-url') ?? process.env.GOOGLE_CHAT_SITE_URL ?? 'https://findmydoc.eu'
  const webhookUrlArg = readArgValue(process.argv, '--webhook-url')
  const messageTextArg = readArgValue(process.argv, '--message-text')
  const messageFile = readArgValue(process.argv, '--message-file')
  const dryRun = process.argv.includes('--dry-run')
  const forceSend = process.argv.includes('--yes')
  const includePrImages = process.argv.includes('--include-pr-images')

  if (!releaseTag) {
    throw new Error('Missing required argument: --release-tag')
  }

  if (messageTextArg && messageFile) {
    throw new Error('Use either --message-text or --message-file, not both.')
  }

  if (webhookUrlArg) {
    throw new Error(
      `Local webhook URLs are no longer supported here. Store the webhook in the ${GOOGLE_CHAT_SECRET_NAME} repository secret and use the workflow-backed send path.`,
    )
  }

  const repoSlug = getRepoSlug()
  const release = getReleaseByTag(repoSlug, releaseTag)
  const releaseUrl = releaseUrlArg ?? release.url
  const messageText = messageFile ? readFileSync(messageFile, 'utf8') : messageTextArg

  if (!release.body?.trim()) {
    throw new Error(`Release ${releaseTag} does not contain generated release notes.`)
  }

  const source = await buildStakeholderAnnouncementSourceWithReferences({
    repoSlug,
    releaseTag,
    releaseUrl,
    siteUrl,
    releaseNotes: release.body,
  })

  if (!messageText) {
    if (!dryRun) {
      throw new Error(
        'Missing message text. Draft the final German announcement in Codex, then pass it via --message-text or --message-file.',
      )
    }

    console.log(renderUsedReleaseItems(source))
    console.log(renderStakeholderAnnouncementSource(source))
  } else {
    const preview = await sendGoogleChatMessage({
      text: messageText,
      dryRun: true,
      releaseTag,
      source,
      includePrImages,
    })
    const workflowDispatches = preview.dispatches.map((dispatch) => ({
      kind: dispatch.kind,
      payload: dispatch.payload,
      workflowDispatchPayload: buildWorkflowDispatchPayload({
        ref: 'main',
        inputs: {
          message_payload_json: JSON.stringify(dispatch.payload),
          release_tag: releaseTag,
        },
      }),
      visuals: dispatch.visuals,
    }))

    if (dryRun) {
      console.log(
        JSON.stringify(
          {
            dispatches: workflowDispatches,
            threadKey: preview.threadKey,
            visualItems: preview.visualItems,
            visuals: preview.visuals,
            workflow: {
              file: GOOGLE_CHAT_WORKFLOW_FILE,
              ref: 'main',
              repositorySecret: GOOGLE_CHAT_SECRET_NAME,
            },
          },
          null,
          2,
        ),
      )
      process.exit(0)
    }

    ensureGhAuth()
    const secretConfigured = repositorySecretExists({
      repoSlug,
      secretName: GOOGLE_CHAT_SECRET_NAME,
    })
    if (!secretConfigured) {
      throw new Error(
        `${GOOGLE_CHAT_SECRET_NAME} repository secret is missing on ${repoSlug}. Set it before sending the Google Chat announcement.`,
      )
    }

    console.log('Google Chat message preview:')
    console.log(preview.payload.text)
    if (preview.visuals.length > 0) {
      console.log(`cardsV2: ${preview.visuals.length} PR image(s)`)
      console.log(`threadKey: ${preview.threadKey}`)
    }

    let shouldSend = forceSend
    if (!shouldSend && process.stdin.isTTY && process.stdout.isTTY) {
      const readline = createInterface({
        input: process.stdin,
        output: process.stdout,
      })
      const answer = await readline.question('Send this Google Chat message now? [y/N] ')
      readline.close()
      shouldSend = /^y(es)?$/i.test(answer.trim())
    }

    if (!shouldSend) {
      console.log('Google Chat message was not sent. Re-run with --yes or use an interactive terminal after approval.')
      process.exit(0)
    }

    fetchMainAndTags()
    const mainHead = getHeadSha('origin/main')
    for (const workflowDispatch of workflowDispatches) {
      const dispatch = dispatchWorkflow({
        repoSlug,
        workflowFile: GOOGLE_CHAT_WORKFLOW_FILE,
        ref: 'main',
        inputs: workflowDispatch.workflowDispatchPayload.inputs,
      })
      console.log(`Google Chat ${workflowDispatch.kind} workflow dispatched.`)

      const workflowRun = await waitForWorkflowRun({
        repoSlug,
        workflowFile: GOOGLE_CHAT_WORKFLOW_FILE,
        ref: 'main',
        headSha: mainHead,
        dispatchedAt: dispatch.dispatchedAt,
      })
      console.log(`Google Chat ${workflowDispatch.kind} sent for ${releaseTag}: ${workflowRun.html_url}`)
    }
  }
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
