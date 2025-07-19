import { WebClient } from '@slack/web-api';
import slackifyMarkdown from 'slackify-markdown';

/**
 * Convert GitHub flavored markdown to Slack's mrkdwn.
 * @param {string} markdown
 * @returns {string} Slack-formatted text
 */
export function githubMarkdownToSlack(markdown) {
  return slackifyMarkdown(markdown ?? '');
}

/**
 * Post a release announcement to Slack.
 * Reads SLACK_BOT_TOKEN and SLACK_CHANNEL from environment variables.
 * @param {{tagName: string; url: string; body: string}} options
 */
export async function postReleaseToSlack({ tagName, url, body }) {
  const token = process.env.SLACK_BOT_TOKEN;
  const channel = process.env.SLACK_CHANNEL;

  if (!token) throw new Error('SLACK_BOT_TOKEN is required');
  if (!channel) throw new Error('SLACK_CHANNEL is required');

  const client = new WebClient(token);
  const text = `🚀 Release ${tagName}. See details on GitHub.`;
  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `🚀 Release ${tagName}` },
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
          text: { type: 'plain_text', text: 'View on GitHub' },
          url,
        },
      ],
    },
  ];

  await client.chat.postMessage({ channel, icon_emoji: ':rocket:', text, blocks });
}

if (require.main === module) {
  const [tagName, url] = process.argv.slice(2);
  const body = process.env.RELEASE_BODY ?? '';

  postReleaseToSlack({ tagName, url, body }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
