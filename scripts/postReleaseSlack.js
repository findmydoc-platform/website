import { readFileSync } from 'fs'

const MAX_SECTION = 3000

/**
 * Convert a subset of GitHub flavored Markdown to Slack mrkdwn.
 * Supports headings, links, strikethrough, inline/code blocks and tables.
 * @param {string} md - Markdown text
 * @returns {string[]} Array of mrkdwn sections
 */
export function githubMarkdownToSlack(md) {
  let text = md.replace(/\r\n/g, '\n').trim()

  // Extract fenced code blocks
  const codeBlocks = []
  text = text.replace(/```([\w-]*)\n([\s\S]*?)```/g, (_m, _l, body) => {
    const token = `@@CODE_${codeBlocks.length}@@`
    codeBlocks.push('```' + body.replace(/\n+$/, '') + '```')
    return token
  })

  // Tables to code blocks
  text = text.replace(/((?:^\s*\|.*\|\s*\n)+)/gm, (block) => {
    const lines = block
      .trim()
      .split('\n')
      .filter((l) => /\|/.test(l))
    const clean = lines.filter((l) => !/^\s*\|?\s*:?-+:?\s*\|/.test(l))
    const rows = clean.map((l) =>
      l
        .replace(/^\s*\|/, '')
        .replace(/\|\s*$/, '')
        .split(/\s*\|\s*/),
    )
    const widths = []
    rows.forEach((r) =>
      r.forEach((c, i) => {
        widths[i] = Math.max(widths[i] || 0, c.length)
      }),
    )
    const formatted = rows.map((r) => r.map((c, i) => c.padEnd(widths[i])).join('  ')).join('\n')
    const token = `@@CODE_${codeBlocks.push('```' + formatted + '```') - 1}@@`
    return token
  })

  text = text.replace(/^#{1,6}\s+(.+)$/gm, (_m, t) => `*${t.trim()}*`)
  text = text.replace(/~~(.+?)~~/g, '~$1~')
  text = text.replace(/\[([^\]]+)]\((https?:\/\/[^\s)]+)\)/g, '<$2|$1>')
  text = text.replace(/!\[([^\]]*)]\((https?:\/\/[^\s)]+)\)/g, '<$2|$1>')

  text = text.replace(/@@CODE_(\d+)@@/g, (_m, i) => codeBlocks[Number(i)])
  text = text.replace(/\n{3,}/g, '\n\n')

  const sections = []
  let buffer = ''
  for (const part of text.split(/\n\n/)) {
    const candidate = (buffer ? buffer + '\n\n' : '') + part
    if (candidate.length > MAX_SECTION) {
      if (buffer) sections.push(buffer)
      buffer = part
      if (buffer.length > MAX_SECTION) {
        while (buffer.length > MAX_SECTION) {
          sections.push(buffer.slice(0, MAX_SECTION - 1))
          buffer = buffer.slice(MAX_SECTION - 1)
        }
      }
    } else {
      buffer = candidate
    }
  }
  if (buffer) sections.push(buffer)
  return sections
}

/**
 * Post release notes to Slack using chat.postMessage.
 */
export async function postReleaseToSlack() {
  const eventPath = process.env.GITHUB_EVENT_PATH
  if (!eventPath) throw new Error('Missing GITHUB_EVENT_PATH')
  const event = JSON.parse(readFileSync(eventPath, 'utf8'))
  const release = event.release
  if (!release) throw new Error('No release data found')
  const sections = githubMarkdownToSlack(release.body || '')
  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `${release.tag_name} – ${release.name || ''}`.slice(0, 150) },
    },
    {
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: `*Repo:* ${process.env.GITHUB_REPOSITORY}` },
        { type: 'mrkdwn', text: `*Author:* ${release.author.login}` },
        { type: 'mrkdwn', text: `*Published:* ${release.published_at}` },
      ],
    },
  ]
  sections.forEach((s) => blocks.push({ type: 'section', text: { type: 'mrkdwn', text: s } }))
  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: { type: 'plain_text', text: 'Open Release' },
        url: release.html_url,
      },
    ],
  })

  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Authorization: `Bearer ${process.env.SLACK_TOKEN}`,
    },
    body: JSON.stringify({ channel: process.env.SLACK_CHANNEL, text: `${release.tag_name} released`, blocks }),
  })

  const json = await response.json()
  if (!json.ok) {
    throw new Error(`Slack API error: ${JSON.stringify(json)}`)
  }
  console.log('Posted to Slack')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  postReleaseToSlack().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
