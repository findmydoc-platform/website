import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createRequire } from 'node:module'
import YAML from 'yaml'

import { afterEach, describe, expect, it } from 'vitest'

const tempDirectories = new Set<string>()
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

const require = createRequire(import.meta.url)
const picomatch = require(path.join(repositoryRoot, 'node_modules/.pnpm/picomatch@2.3.2/node_modules/picomatch')) as (
  pattern: string,
  options: { dot: boolean },
) => (file: string) => boolean
const workflow = YAML.parse(fs.readFileSync(path.join(repositoryRoot, '.github/workflows/db-quality.yml'), 'utf8'))
const pathInputs = workflow.jobs['detect-db-changes'].steps.find((step: { id?: string }) => step.id === 'paths').with
const filters = YAML.parse(pathInputs.filters) as Record<string, (string | Record<string, string>)[]>
type ChangedFile = { filename: string; status: 'added' | 'modified' | 'copied' | 'deleted' }
const selectPaths = (filter: string, files: (string | ChangedFile)[]) => {
  const matches = (file: ChangedFile, rule: string | Record<string, string>) => {
    if (typeof rule === 'string') return picomatch(rule, { dot: true })(file.filename)
    return Object.entries(rule).some(
      ([statuses, pattern]) =>
        statuses.split('|').includes(file.status) && picomatch(pattern, { dot: true })(file.filename),
    )
  }
  return files
    .map((file): ChangedFile => (typeof file === 'string' ? { filename: file, status: 'modified' } : file))
    .filter((file) =>
      pathInputs['predicate-quantifier'] === 'every'
        ? filters[filter]!.every((rule) => matches(file, rule))
        : filters[filter]!.some((rule) => matches(file, rule)),
    )
    .map((file) => file.filename)
}

afterEach(() => {
  for (const directoryPath of tempDirectories) {
    fs.rmSync(directoryPath, { force: true, recursive: true })
  }

  tempDirectories.clear()
})

const initialPayloadConfig = `import { seedGetHandler } from './endpoints/seed/seedEndpoint'

export default {
  endpoints: [
    { path: '/seed', method: 'get', handler: seedGetHandler as PayloadHandler },
  ],
}
`

const initialImportExportPluginIndex = `import { importExportPlugin } from '@payloadcms/plugin-import-export'

export const plugins = [
  importExportPlugin({
    collections: [
      { slug: 'pages' },
      { slug: 'patients' },
    ],
  }),
]
`

const extractedImportExportPluginIndex = `import { importExport } from './importExport'

export const plugins = [
  importExport,
]
`

const runtimeOnlyImportExportModule = `import { importExportPlugin } from '@payloadcms/plugin-import-export'
import type { ImportExportPluginConfig } from '@payloadcms/plugin-import-export/types'
import type { CollectionSlug } from 'payload'

import { securePlatformManagedPluginCollection } from '@/security/generatedCollectionAccess'

export const importExportTargetSlugs = [
  'pages',
  'countries',
] as const satisfies readonly CollectionSlug[]

export const importExportPluginConfig = {
  collections: importExportTargetSlugs.map((slug) => ({ slug })),
  overrideExportCollection: securePlatformManagedPluginCollection,
  overrideImportCollection: securePlatformManagedPluginCollection,
} satisfies ImportExportPluginConfig

export const importExport = importExportPlugin(importExportPluginConfig)
`

const pluginIndexWithoutManagedAccess = `import { formBuilderPlugin } from '@payloadcms/plugin-form-builder'
import { redirectsPlugin } from '@payloadcms/plugin-redirects'

export const plugins = [
  redirectsPlugin({
    overrides: {
      admin: { group: 'Settings' },
    },
  }),
  formBuilderPlugin({
    formOverrides: {
      admin: { group: 'Settings' },
    },
    formSubmissionOverrides: {
      admin: { group: 'Platform Management' },
    },
  }),
]
`

const pluginIndexWithManagedAccess = `import { formBuilderPlugin } from '@payloadcms/plugin-form-builder'
import { redirectsPlugin } from '@payloadcms/plugin-redirects'
import { generatedCollectionAccess } from '@/security/generatedCollectionAccess'

export const plugins = [
  redirectsPlugin({
    overrides: {
      access: generatedCollectionAccess.redirects,
      admin: { group: 'Settings' },
    },
  }),
  formBuilderPlugin({
    formOverrides: {
      access: generatedCollectionAccess.forms,
      admin: { group: 'Settings' },
    },
    formSubmissionOverrides: {
      access: generatedCollectionAccess['form-submissions'],
      admin: { group: 'Platform Management' },
    },
  }),
]
`

const createTempRepo = () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'detect-migration-diff-'))
  tempDirectories.add(rootDir)

  fs.mkdirSync(path.join(rootDir, 'src'), { recursive: true })
  fs.writeFileSync(path.join(rootDir, 'src', 'payload.config.ts'), initialPayloadConfig, 'utf8')

  runGit(rootDir, ['init'])
  runGit(rootDir, ['config', 'user.email', 'tests@example.com'])
  runGit(rootDir, ['config', 'user.name', 'Test Runner'])
  runGit(rootDir, ['add', '.'])
  runGit(rootDir, ['commit', '--message', 'initial config'])

  return rootDir
}

const runGit = (rootDir: string, args: string[]) => {
  execFileSync('git', args, { cwd: rootDir, stdio: 'pipe' })
}

const commitPayloadConfig = (rootDir: string, source: string) => {
  fs.writeFileSync(path.join(rootDir, 'src', 'payload.config.ts'), source, 'utf8')
  runGit(rootDir, ['add', 'src/payload.config.ts'])
  runGit(rootDir, ['commit', '--message', 'update payload config'])
}

const commitFile = (rootDir: string, relativePath: string, source: string) => {
  const filePath = path.join(rootDir, relativePath)

  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, source, 'utf8')
  runGit(rootDir, ['add', relativePath])
  runGit(rootDir, ['commit', '--message', `update ${relativePath}`])
}

const commitFiles = (rootDir: string, files: Record<string, string>) => {
  for (const [relativePath, source] of Object.entries(files)) {
    const filePath = path.join(rootDir, relativePath)

    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, source, 'utf8')
  }

  const relativePaths = Object.keys(files)
  runGit(rootDir, ['add', ...relativePaths])
  runGit(rootDir, ['commit', '--message', 'update multiple files'])
}

const runDetector = (rootDir: string, event = 'push', base = '', overrides: Record<string, string> = {}) => {
  const outputPath = path.join(rootDir, 'github-output')
  const changed: ChangedFile[] = []
  try {
    const fields = execFileSync(
      'git',
      [
        'diff',
        '--name-status',
        '--no-renames',
        '-z',
        event === 'pull_request' ? `origin/${base}...HEAD` : 'HEAD~1...HEAD',
      ],
      { cwd: rootDir, stdio: 'pipe' },
    )
      .toString()
      .split('\0')
      .filter(Boolean)
    const statuses: Record<string, ChangedFile['status']> = { A: 'added', M: 'modified', C: 'copied', D: 'deleted' }
    for (let index = 0; index < fields.length; index += 2) {
      const status = statuses[fields[index]![0]!]
      if (status) changed.push({ filename: fields[index + 1]!, status })
    }
  } catch {
    /* A first commit has no comparison predecessor. */
  }
  const selection = {
    CHANGED_FILES: JSON.stringify(selectPaths('changed', changed)),
    SCHEMA_FILES: JSON.stringify(selectPaths('schema', changed)),
    BLOCK_SCHEMA_FILES: JSON.stringify(selectPaths('block_schema', changed)),
    PAYLOAD_SCHEMA_FILES: JSON.stringify(selectPaths('payload_schema', changed)),
    MIGRATIONS_CHANGED: String(selectPaths('migrations', changed).length > 0),
    DB_TOOLING_CHANGED: String(selectPaths('tooling', changed).length > 0),
  }
  execFileSync('bash', [path.join(repositoryRoot, '.github/scripts/ci/detect-migration-diff.sh'), event, base], {
    cwd: rootDir,
    env: { ...process.env, ...selection, ...overrides, GITHUB_OUTPUT: outputPath },
    stdio: 'pipe',
  })

  return fs.readFileSync(outputPath, 'utf8')
}

describe('detect-migration-diff', () => {
  it('does not require a migration for an endpoint-only Payload config change', () => {
    const rootDir = createTempRepo()

    commitPayloadConfig(
      rootDir,
      `import { cacheRevalidationVisibilityGetHandler } from './endpoints/cacheRevalidationVisibility'
import { seedGetHandler } from './endpoints/seed/seedEndpoint'

export default {
  endpoints: [
    { path: '/seed', method: 'get', handler: seedGetHandler as PayloadHandler },
    {
      path: '/cache-revalidation/visibility',
      method: 'get',
      handler: cacheRevalidationVisibilityGetHandler as PayloadHandler,
    },
  ],
}
`,
    )

    const output = runDetector(rootDir)

    expect(output).toContain('db_changed=false')
    expect(output).toContain('schema_changed=false')
  })

  it('keeps non-endpoint Payload config changes schema-relevant', () => {
    const rootDir = createTempRepo()

    commitPayloadConfig(
      rootDir,
      `${initialPayloadConfig}\nexport const generatedTypes = { outputFile: 'src/payload-types.ts' }\n`,
    )

    const output = runDetector(rootDir)

    expect(output).toContain('db_changed=true')
    expect(output).toContain('schema_changed=true')
  })

  it('does not require a migration for a Payload upload parser policy change', () => {
    const rootDir = createTempRepo()

    commitPayloadConfig(
      rootDir,
      `import { MEDIA_UPLOAD_MAX_BYTES, MEDIA_UPLOAD_TOO_LARGE_MESSAGE } from '@/config/mediaUploadPolicy'
import { seedGetHandler } from './endpoints/seed/seedEndpoint'

export default {
  upload: {
    limits: {
      fileSize: MEDIA_UPLOAD_MAX_BYTES,
    },
    abortOnLimit: true,
    responseOnLimit: MEDIA_UPLOAD_TOO_LARGE_MESSAGE,
    safeFileNames: true,
  },
  endpoints: [
    { path: '/seed', method: 'get', handler: seedGetHandler as PayloadHandler },
  ],
}
`,
    )

    const output = runDetector(rootDir)

    expect(output).toContain('db_changed=false')
    expect(output).toContain('schema_changed=false')
  })

  it('does not require a migration for scoped agent instructions', () => {
    const rootDir = createTempRepo()

    commitFile(rootDir, 'src/collections/AGENTS.md', '# Collection instructions\n')

    const output = runDetector(rootDir)

    expect(output).toContain('db_changed=false')
    expect(output).toContain('schema_changed=false')
  })

  it('keeps collection config changes schema-relevant', () => {
    const rootDir = createTempRepo()

    commitFile(rootDir, 'src/collections/Doctors/index.ts', "export const Doctors = { slug: 'doctors' }\n")

    const output = runDetector(rootDir)

    expect(output).toContain('db_changed=true')
    expect(output).toContain('schema_changed=true')
  })

  it('does not require a migration for collection field access-only changes', () => {
    const rootDir = createTempRepo()

    commitFile(
      rootDir,
      'src/collections/ClinicStaff.ts',
      `export const ClinicStaff = {
  fields: [
    {
      name: 'clinic',
      type: 'relationship',
      relationTo: 'clinics',
    },
  ],
}
`,
    )

    commitFile(
      rootDir,
      'src/collections/ClinicStaff.ts',
      `import { platformOnlyFieldAccess } from '@/access/fieldAccess'

export const ClinicStaff = {
  fields: [
    {
      name: 'clinic',
      type: 'relationship',
      relationTo: 'clinics',
      access: {
        // Clinic assignment defines tenant access and may only be changed by Platform Staff.
        create: platformOnlyFieldAccess,
        update: platformOnlyFieldAccess,
      },
    },
  ],
}
`,
    )

    const output = runDetector(rootDir)

    expect(output).toContain('db_changed=false')
    expect(output).toContain('schema_changed=false')
  })

  it('does not require a migration when a field access import expands across lines', () => {
    const rootDir = createTempRepo()

    commitFile(
      rootDir,
      'src/collections/Clinics.ts',
      `import { platformClinicTrustAccess, platformClinicTrustFieldAccess } from '@/access/fieldAccess'

export const Clinics = {
  fields: [
    {
      name: 'averageRating',
      type: 'number',
    },
  ],
}
`,
    )

    commitFile(
      rootDir,
      'src/collections/Clinics.ts',
      `import {
  computedOnlyFieldAccess,
  platformClinicTrustAccess,
  platformClinicTrustFieldAccess,
} from '@/access/fieldAccess'

export const Clinics = {
  fields: [
    {
      name: 'averageRating',
      type: 'number',
      access: {
        create: computedOnlyFieldAccess,
        update: computedOnlyFieldAccess,
      },
    },
  ],
}
`,
    )

    const output = runDetector(rootDir)

    expect(output).toContain('db_changed=false')
    expect(output).toContain('schema_changed=false')
  })

  it('keeps mixed field access and schema changes schema-relevant', () => {
    const rootDir = createTempRepo()

    commitFile(
      rootDir,
      'src/collections/ClinicStaff.ts',
      `export const ClinicStaff = {
  fields: [
    {
      name: 'clinic',
      type: 'relationship',
      relationTo: 'clinics',
    },
  ],
}
`,
    )

    commitFile(
      rootDir,
      'src/collections/ClinicStaff.ts',
      `export const ClinicStaff = {
  fields: [
    {
      name: 'clinic',
      type: 'relationship',
      relationTo: 'clinics',
      required: true,
      access: {
        create: platformOnlyFieldAccess,
        update: platformOnlyFieldAccess,
      },
    },
  ],
}
`,
    )

    const output = runDetector(rootDir)

    expect(output).toContain('db_changed=true')
    expect(output).toContain('schema_changed=true')
  })

  it('does not require a migration for a collection upload UI and validation hook change', () => {
    const rootDir = createTempRepo()

    commitFile(
      rootDir,
      'src/collections/Doctors/index.ts',
      `import { beforeOperationPrepareUploadFilename } from '@/hooks/media/prepareUploadFilename'

export const Doctors = {
  slug: 'doctors',
  admin: {
    group: 'Media',
  },
  hooks: {
    beforeOperation: [beforeOperationPrepareUploadFilename],
  },
}
`,
    )

    commitFile(
      rootDir,
      'src/collections/Doctors/index.ts',
      `import { beforeOperationPrepareUploadFilename } from '@/hooks/media/prepareUploadFilename'
import { beforeOperationValidateMediaUpload } from '@/hooks/media/validateMediaUpload'

export const Doctors = {
  slug: 'doctors',
  admin: {
    group: 'Media',
    components: {
      edit: {
        Upload: '@/app/(payload)/components/PolicyAwareUpload',
      },
    },
  },
  hooks: {
    beforeOperation: [beforeOperationValidateMediaUpload, beforeOperationPrepareUploadFilename],
  },
}
`,
    )

    const output = runDetector(rootDir)

    expect(output).toContain('db_changed=false')
    expect(output).toContain('schema_changed=false')
  })

  it('does not require a migration when a doctor validation hook expands the hook array', () => {
    const rootDir = createTempRepo()

    commitFile(
      rootDir,
      'src/collections/Doctors.ts',
      `import { beforeChangeAssignClinicFromUser } from '@/hooks/clinicOwnership'
import { stableIdBeforeChangeHook } from '@/hooks/stableId'

export const Doctors = {
  hooks: {
    beforeChange: [stableIdBeforeChangeHook, beforeChangeAssignClinicFromUser({ clinicField: 'clinic' })],
  },
}
`,
    )

    commitFile(
      rootDir,
      'src/collections/Doctors.ts',
      `import { beforeChangeAssignClinicFromUser } from '@/hooks/clinicOwnership'
import { beforeChangeValidateDoctorProfileImage } from '@/hooks/doctorProfileImageOwnership'
import { stableIdBeforeChangeHook } from '@/hooks/stableId'

export const Doctors = {
  hooks: {
    beforeChange: [
      stableIdBeforeChangeHook,
      beforeChangeAssignClinicFromUser({ clinicField: 'clinic' }),
      beforeChangeValidateDoctorProfileImage,
    ],
  },
}
`,
    )

    const output = runDetector(rootDir)

    expect(output).toContain('db_changed=false')
    expect(output).toContain('schema_changed=false')
  })

  it('does not require a migration when import/export policy moves into its runtime-only module', () => {
    const rootDir = createTempRepo()

    commitFile(rootDir, 'src/plugins/index.ts', initialImportExportPluginIndex)
    commitFiles(rootDir, {
      'src/plugins/index.ts': extractedImportExportPluginIndex,
      'src/plugins/importExport.ts': runtimeOnlyImportExportModule,
      'src/security/generatedCollectionAccess.ts': 'export const generatedCollectionAccess = {}\n',
    })

    const output = runDetector(rootDir)

    expect(output).toContain('db_changed=false')
    expect(output).toContain('schema_changed=false')
  })

  it('keeps unrecognized import/export plugin module changes schema-relevant', () => {
    const rootDir = createTempRepo()
    const schemaChangingModule = runtimeOnlyImportExportModule.replace(
      'overrideExportCollection: securePlatformManagedPluginCollection,',
      `overrideExportCollection: ({ collection }) => ({
    ...collection,
    fields: [...collection.fields, { name: 'schemaField', type: 'text' }],
  }),`,
    )

    commitFile(rootDir, 'src/plugins/index.ts', initialImportExportPluginIndex)
    commitFiles(rootDir, {
      'src/plugins/index.ts': extractedImportExportPluginIndex,
      'src/plugins/importExport.ts': schemaChangingModule,
    })

    const output = runDetector(rootDir)

    expect(output).toContain('db_changed=true')
    expect(output).toContain('schema_changed=true')
  })

  it('does not require a migration for managed plugin collection access-only changes', () => {
    const rootDir = createTempRepo()

    commitFile(rootDir, 'src/plugins/index.ts', pluginIndexWithoutManagedAccess)
    commitFile(rootDir, 'src/plugins/index.ts', pluginIndexWithManagedAccess)

    const output = runDetector(rootDir)

    expect(output).toContain('db_changed=false')
    expect(output).toContain('schema_changed=false')
  })

  it('keeps mixed plugin access and schema changes schema-relevant', () => {
    const rootDir = createTempRepo()
    const schemaChangingPluginIndex = pluginIndexWithManagedAccess.replace(
      "admin: { group: 'Settings' },",
      "admin: { group: 'Settings' },\n      fields: [{ name: 'schemaField', type: 'text' }],",
    )

    commitFile(rootDir, 'src/plugins/index.ts', pluginIndexWithoutManagedAccess)
    commitFile(rootDir, 'src/plugins/index.ts', schemaChangingPluginIndex)

    const output = runDetector(rootDir)

    expect(output).toContain('db_changed=true')
    expect(output).toContain('schema_changed=true')
  })
})

describe('DB classifier event contracts', () => {
  it('keeps a first commit empty', () => {
    expect(runDetector(createTempRepo())).toContain('db_changed=false')
  })
  it('forces only migration application on manual dispatch', () => {
    const output = runDetector(createTempRepo(), 'workflow_dispatch')
    expect(output).toContain('db_changed=true')
    expect(output).toContain('schema_changed=false')
    expect(output).toContain('risk_scan_needed=false')
  })
  it('rejects malformed selected path input', () => {
    expect(() => runDetector(createTempRepo(), 'push', '', { SCHEMA_FILES: '{}' })).toThrow()
  })
  it('uses all PR commits for the retained content classifier', () => {
    const rootDir = createTempRepo()
    runGit(rootDir, ['branch', 'comparison-base'])
    runGit(rootDir, ['remote', 'add', 'origin', rootDir])
    runGit(rootDir, ['fetch', 'origin', 'comparison-base'])
    commitPayloadConfig(
      rootDir,
      `${initialPayloadConfig}\nexport const generatedTypes = { outputFile: 'src/payload-types.ts' }\n`,
    )
    commitFile(rootDir, 'docs/change.md', 'Documentation only in the last commit.')
    expect(runDetector(rootDir, 'pull_request', 'comparison-base')).toContain('schema_changed=true')
    expect(runDetector(rootDir)).toContain('schema_changed=false')
  })
  it('passes selected migrations and tooling decisions to the stable outputs', () => {
    const rootDir = createTempRepo()
    commitFile(rootDir, 'src/migrations/new.ts', 'export const up = () => {}')
    const output = runDetector(rootDir)
    expect(output).toContain('db_changed=true')
    expect(output).toContain('migrations_changed=true')
    expect(output).toContain('risk_scan_needed=true')
  })
})

describe('DB workflow path selection', () => {
  it.each(['added', 'modified', 'copied', 'deleted'] as const)('handles %s schema and migration paths', (status) => {
    const expected = status === 'deleted' ? [] : ['src/payload.config.ts']
    expect(selectPaths('payload_schema', [{ filename: 'src/payload.config.ts', status }])).toEqual(expected)
    expect(selectPaths('migrations', [{ filename: 'src/migrations/new.ts', status }])).toEqual(
      status === 'deleted' ? [] : ['src/migrations/new.ts'],
    )
  })
  it('does not apply migration checks for deleted-only paths', () => {
    const rootDir = createTempRepo()
    commitFile(rootDir, 'src/migrations/old.ts', 'export const up = () => {}')
    runGit(rootDir, ['rm', 'src/migrations/old.ts'])
    runGit(rootDir, ['commit', '--message', 'delete migration fixture'])
    expect(runDetector(rootDir)).toContain('migrations_changed=false')
  })
  it('normalizes a renamed migration to its added new path', () => {
    const rootDir = createTempRepo()
    commitFile(rootDir, 'src/migrations/old.ts', 'export const up = () => {}')
    runGit(rootDir, ['mv', 'src/migrations/old.ts', 'src/migrations/new.ts'])
    runGit(rootDir, ['commit', '--message', 'rename migration fixture'])
    const output = runDetector(rootDir)
    expect(output).toContain('migrations_changed=true')
    expect(output).toContain('src/migrations/new.ts')
    expect(output).not.toContain('src/migrations/old.ts')
  })

  it.each([
    ['src/collections/Clinics/index.ts', true],
    ['src/collections/Clinics/AGENTS.md', false],
    ['src/collections/Clinics/AGENTS.override.md', false],
    ['src/collections/Clinics/hooks/update.ts', false],
    ['src/collections/.hidden/index.ts', true],
    ['src/collections/Clinic space/index.ts', true],
    ['src/collections/Clinic$(echo bad)/index.ts', true],
    ['docs/database.md', false],
  ])('selects schema path %s: %s', (file, selected) => {
    expect(selectPaths('schema', [file])).toEqual(selected ? [file] : [])
  })
  it('selects block config files without selecting renderers', () => {
    expect(
      selectPaths('block_schema', [
        'src/blocks/Test/config.ts',
        'src/blocks/Test/config.tsx',
        'src/blocks/Test/nested/config.ts',
        'src/blocks/Test space/config.ts',
        'src/blocks/Test/Component.tsx',
      ]),
    ).toEqual(['src/blocks/Test/config.ts', 'src/blocks/Test/config.tsx', 'src/blocks/Test/nested/config.ts'])
  })
  it('selects each independent database tooling alternative', () => {
    const files = [
      '.github/workflows/db-quality.yml',
      '.github/workflows/deploy.yml',
      '.github/scripts/ci/detect-migration-diff.sh',
      '.github/scripts/ci/enforce-schema-migration.sh',
      '.github/scripts/ci/wait-for-postgres.sh',
      'scripts/migration-risk-scan.mjs',
      'scripts/test-database-harness.mjs',
      'vitest.config.ts',
    ]
    expect(selectPaths('tooling', [...files, 'scripts/unrelated.mjs'])).toEqual(files)
  })
})
