#!/usr/bin/env node

import { createInterface } from 'node:readline/promises'
import process from 'node:process'
import { getReleaseByTag, getRepoSlug, parseChatMessageOverrides, readArgValue, sendGoogleChatMessage } from './lib.mjs'

try {
  const releaseTag = readArgValue(process.argv, '--release-tag')
  const releaseUrlArg = readArgValue(process.argv, '--release-url')
  const siteUrl = readArgValue(process.argv, '--site-url') ?? process.env.GOOGLE_CHAT_SITE_URL ?? 'https://findmydoc.eu'
  const webhookUrl = readArgValue(process.argv, '--webhook-url') ?? process.env.GOOGLE_CHAT_WEBHOOK_URL ?? null
  const dryRun = process.argv.includes('--dry-run')
  const forceSend = process.argv.includes('--yes')
  const chatOverrides = parseChatMessageOverrides(process.argv)

  if (!releaseTag) {
    throw new Error('Missing required argument: --release-tag')
  }

  if (!dryRun && !webhookUrl) {
    throw new Error('Missing Google Chat webhook URL. Set GOOGLE_CHAT_WEBHOOK_URL or pass --webhook-url.')
  }

  const repoSlug = getRepoSlug()
  const release = getReleaseByTag(repoSlug, releaseTag)
  const releaseUrl = releaseUrlArg ?? release.url

  if (!release.body?.trim()) {
    throw new Error(`Release ${releaseTag} does not contain generated release notes.`)
  }

  const preview = await sendGoogleChatMessage({
    releaseTag,
    releaseUrl,
    siteUrl,
    releaseNotes: release.body,
    webhookUrl: webhookUrl ?? 'https://example.invalid',
    dryRun: true,
    overrides: chatOverrides,
  })

  if (dryRun) {
    console.log(JSON.stringify(preview.payload, null, 2))
  } else {
    console.log('Google Chat message preview:')
    console.log(preview.payload.text)

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

    await sendGoogleChatMessage({
      releaseTag,
      releaseUrl,
      siteUrl,
      releaseNotes: release.body,
      webhookUrl,
      overrides: chatOverrides,
    })
    console.log(`Google Chat notification sent for ${releaseTag}.`)
  }
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
