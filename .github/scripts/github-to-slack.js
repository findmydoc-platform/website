const fs = require('fs')
const { WebClient } = require('@slack/web-api')
const slackifyMarkdown = require('slackify-markdown')

/**
 * Convert GitHub flavored markdown to Slack mrkdwn.
 * @param {string} markdown
 * @returns {string}
 */
function githubMarkdownToSlack(markdown = '') {
  return slackifyMarkdown(markdown)
}

/**
 * Post release information to Slack.
 * @param {object} options
 * @param {string} options.bodyFile - path to markdown file containing release notes
 */
async function postReleaseToSlack({ bodyFile }) {
  // deconstruct environment variables
  const { SLACK_BOT_TOKEN: token, SLACK_CHANNEL: channel, TAG_NAME: tag, RELEASE_URL: url } = process.env

  if (!token || !channel || !tag || !url) {
    throw new Error('Missing required environment variables: SLACK_BOT_TOKEN, SLACK_CHANNEL, TAG_NAME, RELEASE_URL')
  }

  if (!fs.existsSync(bodyFile)) {
    throw new Error(`Release body file does not exist: ${bodyFile}`)
  }

  const body = fs.existsSync(bodyFile) ? fs.readFileSync(bodyFile, 'utf8') : ''

  const client = new WebClient(token)

  await client.chat.postMessage({
    channel,
    icon_emoji: ':rocket:',
    text: `\uD83D\uDE80 Release ${tag}. See details on GitHub.`,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `\uD83D\uDE80 Release ${tag}` },
      },
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `<${url}|View on GitHub>` }],
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: githubMarkdownToSlack(body) },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'View Release' },
            url,
          },
        ],
      },
    ],
  })
}

module.exports = { githubMarkdownToSlack, postReleaseToSlack }

if (require.main === module) {
  postReleaseToSlack({ bodyFile: process.argv[2] }).catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
