const { syncManagedFileReviewComments } = require('./lib/review-comment-sync.cjs')

const SCHEMA_CATEGORY = 'schema-config'
const DEPENDENCY_CATEGORY = 'payload-dependencies'
const TYPES_CATEGORY = 'generated-types'

const isSchemaConfigPath = (filename) =>
  filename === 'src/payload.config.ts' ||
  filename.startsWith('src/collections/') ||
  filename.startsWith('src/globals/') ||
  filename.startsWith('src/blocks/') ||
  filename.startsWith('src/fields/') ||
  filename.startsWith('src/plugins/')

const isDependencyPath = (filename) => filename === 'package.json' || filename === 'pnpm-lock.yaml'

const hasPayloadDependencyDiff = (files) =>
  files.some((file) => {
    if (!isDependencyPath(file.filename)) {
      return false
    }

    const patch = String(file.patch ?? '')

    if (file.filename === 'package.json') {
      return /^[+-][ \t]+"(payload|@payloadcms\/[^"]+)":/m.test(patch)
    }

    return /^[+-].*(@payloadcms\/|(^|[^A-Za-z0-9_])payload@)/m.test(patch)
  })

const formatChangedFiles = (files) =>
  files
    .slice(0, 5)
    .map((file) => `- \`${file.filename}\``)
    .join('\n')

const getPayloadCategoryFlags = (categoryStates) => ({
  schemaConfigChanged: Boolean(categoryStates[SCHEMA_CATEGORY]?.active),
  payloadDependencyChanged: Boolean(categoryStates[DEPENDENCY_CATEGORY]?.active),
  payloadTypesChanged: Boolean(categoryStates[TYPES_CATEGORY]?.active),
})

const payloadTypeReviewCategories = [
  {
    key: SCHEMA_CATEGORY,
    isActive: ({ files }) => files.some((file) => isSchemaConfigPath(file.filename)),
    getAnchorPath: ({ files }) => files.find((file) => isSchemaConfigPath(file.filename))?.filename ?? '',
    buildBody: ({ files, categoryStates }) => {
      const { payloadTypesChanged } = getPayloadCategoryFlags(categoryStates)
      const lead = payloadTypesChanged
        ? 'Payload schema/config inputs changed in this PR, and `src/payload-types.ts` also changed.'
        : 'Payload schema/config inputs changed in this PR, but `src/payload-types.ts` did not.'

      return [
        lead,
        '',
        'Review whether the generated Payload types are expected for these schema/config changes, then resolve this conversation.',
        '',
        'Changed files:',
        formatChangedFiles(files.filter((file) => isSchemaConfigPath(file.filename))),
      ].join('\n')
    },
  },
  {
    key: DEPENDENCY_CATEGORY,
    isActive: ({ files }) => hasPayloadDependencyDiff(files),
    getAnchorPath: ({ files }) =>
      files.find((file) => file.filename === 'package.json')?.filename ??
      files.find((file) => file.filename === 'pnpm-lock.yaml')?.filename ??
      '',
    buildBody: ({ files, categoryStates }) => {
      const { payloadTypesChanged } = getPayloadCategoryFlags(categoryStates)
      const lead = payloadTypesChanged
        ? 'Payload package versions changed in this PR, and `src/payload-types.ts` also changed.'
        : 'Payload package versions changed in this PR, but `src/payload-types.ts` did not.'

      return [
        lead,
        '',
        'Upstream Payload releases can change generated type output. Review whether the resulting Payload types are expected for this dependency change, then resolve this conversation.',
        '',
        'Changed files:',
        formatChangedFiles(files.filter((file) => isDependencyPath(file.filename))),
      ].join('\n')
    },
  },
  {
    key: TYPES_CATEGORY,
    isActive: ({ files }) => files.some((file) => file.filename === 'src/payload-types.ts'),
    getAnchorPath: () => 'src/payload-types.ts',
    buildBody: ({ categoryStates }) => {
      const { schemaConfigChanged, payloadDependencyChanged } = getPayloadCategoryFlags(categoryStates)
      const lead =
        schemaConfigChanged || payloadDependencyChanged
          ? '`src/payload-types.ts` changed in this PR.'
          : '`src/payload-types.ts` changed without a detected schema/config or Payload dependency change in this PR.'

      return [
        lead,
        '',
        'Review whether this generated type diff is intentional, then resolve this conversation.',
        '',
        'Changed files:',
        '- `src/payload-types.ts`',
      ].join('\n')
    },
  },
]

module.exports = async function run({ github, context, core }) {
  await syncManagedFileReviewComments({
    github,
    context,
    core,
    scopeName: 'payload-type-review',
    categories: payloadTypeReviewCategories,
  })
}
