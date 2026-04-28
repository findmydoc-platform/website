const { syncManagedPullRequestFeedback } = require('./lib/review-comment-sync.cjs')

function readBoolean(value) {
  return (
    String(value ?? '')
      .trim()
      .toLowerCase() === 'true'
  )
}

function buildPayloadTypeReviewBody({
  schemaConfigChanged,
  payloadDependencyChanged,
  unknownOtherCause,
  diffSnippet,
  mode,
}) {
  const lines = [
    'CI generated Payload types differ between the PR base and head commits on the same runner.',
    '',
    'Likely cause flags (inferred, not proven):',
    `- schema/config change: \`${schemaConfigChanged}\``,
    `- payload dependency change: \`${payloadDependencyChanged}\``,
    `- unknown/other: \`${unknownOtherCause}\``,
    '',
    'The snippet below shows the first 3 hunks / 120 lines of the CI-generated diff. Review whether this generator output is expected, then resolve this conversation.',
  ]

  if (mode === 'sticky') {
    lines.push(
      '',
      'No suitable changed PR file was available for a file review thread, so this was posted as a PR comment.',
    )
  }

  lines.push(
    '',
    '<details><summary>CI-generated payload type diff snippet</summary>',
    '',
    '```diff',
    diffSnippet.trimEnd(),
    '```',
    '</details>',
  )

  return lines.join('\n')
}

module.exports = async function run({ github, context, core, env = process.env }) {
  const mode = String(env.PAYLOAD_TYPE_REVIEW_MODE ?? 'none')

  await syncManagedPullRequestFeedback({
    github,
    context,
    core,
    scopeName: 'payload-type-review',
    key: 'generated-diff',
    mode,
    anchorPath: env.PAYLOAD_TYPE_REVIEW_ANCHOR_PATH ?? '',
    body: buildPayloadTypeReviewBody({
      schemaConfigChanged: readBoolean(env.PAYLOAD_TYPE_SCHEMA_CONFIG_CHANGED),
      payloadDependencyChanged: readBoolean(env.PAYLOAD_TYPE_PAYLOAD_DEPENDENCY_CHANGED),
      unknownOtherCause: readBoolean(env.PAYLOAD_TYPE_UNKNOWN_OTHER_CAUSE),
      diffSnippet: String(env.PAYLOAD_TYPE_DIFF_SNIPPET ?? '').trim(),
      mode,
    }),
  })
}
