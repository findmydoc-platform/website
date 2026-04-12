import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
import pg from 'pg'

const { Client } = pg

const DOCKER_COMPOSE = 'docker compose -p findmydoc-test -f docker-compose.test.yml'
const DEFAULT_CONN = 'postgresql://postgres:password@localhost:5433/findmydoc-test' // pragma: allowlist secret
const TEMPLATE_METADATA_TABLE = 'codex_test_template_metadata'
const DEFAULT_TEMPLATE_KIND = 'empty'
const TEMPLATE_SUFFIXES = {
  empty: 'template_empty',
  baseline: 'template_baseline',
}
const TEMPLATE_DEPENDENCIES = {
  empty: ['empty'],
  baseline: ['empty', 'baseline'],
}
const TEMPLATE_FINGERPRINT_INPUTS = {
  empty: ['src/migrations', 'src/payload.config.ts'],
  baseline: ['src/migrations', 'src/endpoints/seed', 'src/payload.config.ts'],
}

export const TEMPLATE_KINDS = ['empty', 'baseline']

const quoteIdentifier = (value) => `"${value.replaceAll('"', '""')}"`

const toPosixPath = (value) => value.split(path.sep).join('/')

/**
 * @typedef {'empty' | 'baseline'} TemplateKind
 */

const collectFilesRecursively = (directoryPath, rootDir) => {
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectFilesRecursively(entryPath, rootDir))
      continue
    }

    if (!entry.isFile()) {
      continue
    }

    files.push(toPosixPath(path.relative(rootDir, entryPath)))
  }

  return files
}

/**
 * @param {TemplateKind | undefined | null} templateKind
 * @returns {TemplateKind}
 */
export function resolveTemplateKind(templateKind) {
  if (templateKind == null) {
    return DEFAULT_TEMPLATE_KIND
  }

  if (!TEMPLATE_KINDS.includes(templateKind)) {
    throw new Error(`Unsupported test database template kind: ${templateKind}`)
  }

  return templateKind
}

/**
 * @param {string} targetDatabaseName
 * @param {TemplateKind | undefined | null} templateKind
 * @returns {string}
 */
export function deriveTemplateDatabaseName(targetDatabaseName, templateKind) {
  const resolvedTemplateKind = resolveTemplateKind(templateKind)
  const suffix = TEMPLATE_SUFFIXES[resolvedTemplateKind]
  const proposedName = `${targetDatabaseName}_${suffix}`

  if (proposedName.length <= 63) {
    return proposedName
  }

  const hash = crypto.createHash('sha256').update(proposedName).digest('hex').slice(0, 12)
  const separatorBudget = 2
  const maxPrefixLength = Math.max(1, 63 - suffix.length - hash.length - separatorBudget)
  const prefix = targetDatabaseName.slice(0, maxPrefixLength)

  return `${prefix}_${suffix}_${hash}`.slice(0, 63)
}

export function deriveDatabaseConfig(connectionString = DEFAULT_CONN) {
  const targetUrl = new URL(connectionString)
  const targetDatabaseName = decodeURIComponent(targetUrl.pathname.replace(/^\//, ''))

  if (!targetDatabaseName) {
    throw new Error(`DATABASE_URI must include a database name: ${connectionString}`)
  }

  const adminUrl = new URL(connectionString)
  adminUrl.pathname = '/postgres'

  return {
    adminConnectionString: adminUrl.toString(),
    connectionString: targetUrl.toString(),
    targetDatabaseName,
    templateDatabaseNames: {
      baseline: deriveTemplateDatabaseName(targetDatabaseName, 'baseline'),
      empty: deriveTemplateDatabaseName(targetDatabaseName, 'empty'),
    },
  }
}

/**
 * @param {TemplateKind | undefined | null} templateKind
 * @returns {TemplateKind[]}
 */
export function resolveRequiredTemplateKinds(templateKind) {
  const resolvedTemplateKind = resolveTemplateKind(templateKind)
  return [...TEMPLATE_DEPENDENCIES[resolvedTemplateKind]]
}

/**
 * @param {TemplateKind | undefined | null} templateKind
 * @returns {string[]}
 */
export function getTemplateFingerprintInputPaths(templateKind) {
  const resolvedTemplateKind = resolveTemplateKind(templateKind)
  return [...TEMPLATE_FINGERPRINT_INPUTS[resolvedTemplateKind]]
}

/**
 * @param {{ rootDir?: string; templateKind?: TemplateKind }} [options]
 * @returns {string}
 */
export function computeTestDatabaseFingerprint({ rootDir = process.cwd(), templateKind } = {}) {
  const fingerprintInputs = getTemplateFingerprintInputPaths(templateKind)
  const files = fingerprintInputs
    .flatMap((relativeInputPath) => {
      const absoluteInputPath = path.resolve(rootDir, relativeInputPath)

      if (!fs.existsSync(absoluteInputPath)) {
        return []
      }

      const stats = fs.statSync(absoluteInputPath)
      if (stats.isDirectory()) {
        return collectFilesRecursively(absoluteInputPath, rootDir)
      }

      if (!stats.isFile()) {
        return []
      }

      return [toPosixPath(path.relative(rootDir, absoluteInputPath))]
    })
    .sort()

  const hash = crypto.createHash('sha256')
  hash.update(`codex-test-db-template-fingerprint:v2:${resolveTemplateKind(templateKind)}\n`)

  for (const relativeFilePath of files) {
    hash.update(`file:${relativeFilePath}\n`)
    hash.update(fs.readFileSync(path.resolve(rootDir, relativeFilePath)))
    hash.update('\n')
  }

  return hash.digest('hex')
}

export function isTemplateMetadataCurrent(metadata, { fingerprint, templateKind }) {
  const resolvedTemplateKind = resolveTemplateKind(templateKind)

  return Boolean(metadata) && metadata.fingerprint === fingerprint && metadata.templateKind === resolvedTemplateKind
}

const buildConnectionStringForDatabase = (connectionString, databaseName) => {
  const databaseUrl = new URL(connectionString)
  databaseUrl.pathname = `/${encodeURIComponent(databaseName)}`
  return databaseUrl.toString()
}

async function withClient(connectionString, callback) {
  const client = new Client({ connectionString })
  await client.connect()

  try {
    return await callback(client)
  } finally {
    await client.end().catch(() => undefined)
  }
}

async function waitForDatabase(connectionString, timeoutMs = 60000, intervalMs = 750) {
  const start = Date.now()
  let consecutiveSuccesses = 0

  while (true) {
    const client = new Client({ connectionString })

    try {
      await client.connect()
      await client.query('SELECT 1')
      await client.end()
      consecutiveSuccesses += 1

      if (consecutiveSuccesses >= 3) {
        return
      }

      await sleep(intervalMs)
    } catch {
      consecutiveSuccesses = 0

      try {
        await client.end()
      } catch {}

      if (Date.now() - start > timeoutMs) {
        throw new Error(`Database not ready after ${timeoutMs}ms at ${connectionString}`)
      }

      await sleep(intervalMs)
    }
  }
}

async function databaseExists(adminClient, databaseName) {
  const result = await adminClient.query('SELECT 1 FROM pg_database WHERE datname = $1', [databaseName])
  return result.rowCount > 0
}

async function terminateConnections(adminClient, databaseName) {
  await adminClient.query(
    'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
    [databaseName],
  )
}

async function alterDatabaseFlags(adminClient, databaseName, { allowConnections, isTemplate }) {
  if (!(await databaseExists(adminClient, databaseName))) {
    return
  }

  const options = []
  if (typeof allowConnections === 'boolean') {
    options.push(`ALLOW_CONNECTIONS ${allowConnections ? 'true' : 'false'}`)
  }

  if (typeof isTemplate === 'boolean') {
    options.push(`IS_TEMPLATE ${isTemplate ? 'true' : 'false'}`)
  }

  if (options.length === 0) {
    return
  }

  await adminClient.query(`ALTER DATABASE ${quoteIdentifier(databaseName)} WITH ${options.join(' ')}`)
}

async function dropDatabaseIfExists(adminClient, databaseName) {
  if (!(await databaseExists(adminClient, databaseName))) {
    return
  }

  try {
    await alterDatabaseFlags(adminClient, databaseName, {
      allowConnections: false,
      isTemplate: false,
    })
  } catch {}

  await terminateConnections(adminClient, databaseName)
  await adminClient.query(`DROP DATABASE ${quoteIdentifier(databaseName)}`)
}

async function createDatabase(adminClient, databaseName, { templateName } = {}) {
  const templateClause = templateName ? ` WITH TEMPLATE ${quoteIdentifier(templateName)}` : ''
  await adminClient.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}${templateClause}`)
}

async function readTemplateMetadata(connectionString) {
  return withClient(connectionString, async (client) => {
    try {
      const result = await client.query(
        `SELECT template_kind, fingerprint FROM public.${quoteIdentifier(TEMPLATE_METADATA_TABLE)} WHERE singleton = true LIMIT 1`,
      )
      const row = result.rows[0]

      if (!row) {
        return null
      }

      return {
        fingerprint: row.fingerprint,
        templateKind: row.template_kind,
      }
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === '42P01') {
        return null
      }

      throw error
    }
  })
}

async function writeTemplateMetadata(connectionString, { fingerprint, templateKind }) {
  await withClient(connectionString, async (client) => {
    await client.query(
      `CREATE TABLE IF NOT EXISTS public.${quoteIdentifier(TEMPLATE_METADATA_TABLE)} (
        singleton boolean PRIMARY KEY DEFAULT true,
        template_kind text NOT NULL,
        fingerprint text NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT NOW()
      )`,
    )

    await client.query(
      `INSERT INTO public.${quoteIdentifier(TEMPLATE_METADATA_TABLE)} (singleton, template_kind, fingerprint)
       VALUES (true, $1, $2)
       ON CONFLICT (singleton) DO UPDATE
       SET template_kind = EXCLUDED.template_kind,
           fingerprint = EXCLUDED.fingerprint,
           updated_at = NOW()`,
      [templateKind, fingerprint],
    )
  })
}

async function inspectTemplateStatesForKinds({
  adminConnectionString,
  fingerprints,
  templateDatabaseNames,
  templateKinds,
}) {
  const allStates = await withClient(adminConnectionString, async (adminClient) => {
    const states = {}

    for (const templateKind of templateKinds) {
      const databaseName = templateDatabaseNames[templateKind]
      const exists = await databaseExists(adminClient, databaseName)

      if (!exists) {
        states[templateKind] = { current: false, exists: false, metadata: null }
        continue
      }

      await alterDatabaseFlags(adminClient, databaseName, { allowConnections: true })

      const metadata = await readTemplateMetadata(buildConnectionStringForDatabase(adminConnectionString, databaseName))
      states[templateKind] = {
        current: isTemplateMetadataCurrent(metadata, { fingerprint: fingerprints[templateKind], templateKind }),
        exists: true,
        metadata,
      }
    }

    return states
  })

  return allStates
}

async function runPayloadMigrateFresh({ attempts = 3, connectionString, delayMs = 2000 } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      execSync("printf 'y\\n' | pnpm run payload migrate:fresh", {
        env: { ...process.env, DATABASE_URI: connectionString, NODE_ENV: 'test' },
        stdio: 'inherit',
      })
      return
    } catch (error) {
      if (attempt === attempts) {
        throw error
      }

      console.warn(`⚠️ migrate:fresh failed (attempt ${attempt}/${attempts}). Retrying in ${delayMs}ms...`)
      await sleep(delayMs)
    }
  }
}

function runBaselineSeed(connectionString) {
  execSync('pnpm run seed:run -- --type baseline --runtime-env test', {
    env: { ...process.env, DATABASE_URI: connectionString, NODE_ENV: 'development' },
    stdio: 'inherit',
  })
}

function runDockerCompose(command) {
  if (command === 'reset') {
    try {
      execSync(`${DOCKER_COMPOSE} down -v --remove-orphans`, { stdio: 'pipe' })
    } catch {}
    return
  }

  if (command === 'stop') {
    try {
      execSync(`${DOCKER_COMPOSE} stop`, { stdio: 'pipe' })
    } catch {}
    return
  }

  execSync(`${DOCKER_COMPOSE} up -d`, { stdio: 'inherit' })
}

async function ensureEmptyTemplate({
  adminConnectionString,
  fingerprint,
  templateDatabaseName,
  targetConnectionString,
}) {
  const emptyTemplateConnectionString = buildConnectionStringForDatabase(targetConnectionString, templateDatabaseName)

  console.log(`📦 Building empty test DB template (${templateDatabaseName})...`)

  await withClient(adminConnectionString, async (adminClient) => {
    await dropDatabaseIfExists(adminClient, templateDatabaseName)
    await createDatabase(adminClient, templateDatabaseName)
  })

  await runPayloadMigrateFresh({ connectionString: emptyTemplateConnectionString })
  await writeTemplateMetadata(emptyTemplateConnectionString, { fingerprint, templateKind: 'empty' })

  await withClient(adminConnectionString, async (adminClient) => {
    await alterDatabaseFlags(adminClient, templateDatabaseName, {
      allowConnections: true,
      isTemplate: true,
    })
  })
}

async function ensureBaselineTemplate({
  adminConnectionString,
  emptyTemplateDatabaseName,
  fingerprint,
  targetConnectionString,
  templateDatabaseName,
}) {
  const baselineTemplateConnectionString = buildConnectionStringForDatabase(
    targetConnectionString,
    templateDatabaseName,
  )

  console.log(`🌱 Building baseline test DB template (${templateDatabaseName})...`)

  await withClient(adminConnectionString, async (adminClient) => {
    await dropDatabaseIfExists(adminClient, templateDatabaseName)
    await terminateConnections(adminClient, emptyTemplateDatabaseName)
    await createDatabase(adminClient, templateDatabaseName, { templateName: emptyTemplateDatabaseName })
  })

  runBaselineSeed(baselineTemplateConnectionString)
  await writeTemplateMetadata(baselineTemplateConnectionString, { fingerprint, templateKind: 'baseline' })

  await withClient(adminConnectionString, async (adminClient) => {
    await alterDatabaseFlags(adminClient, templateDatabaseName, {
      allowConnections: true,
      isTemplate: true,
    })
  })
}

async function rebuildWorkingDatabaseFromTemplate({ adminConnectionString, targetDatabaseName, templateDatabaseName }) {
  await withClient(adminConnectionString, async (adminClient) => {
    await terminateConnections(adminClient, templateDatabaseName)
    await dropDatabaseIfExists(adminClient, targetDatabaseName)
    await createDatabase(adminClient, targetDatabaseName, { templateName: templateDatabaseName })
    await alterDatabaseFlags(adminClient, targetDatabaseName, {
      allowConnections: true,
      isTemplate: false,
    })
  })
}

export async function setupTestDatabase(options = {}) {
  const startedAt = Date.now()
  const templateKind = resolveTemplateKind(options.templateKind)
  const requiredTemplateKinds = resolveRequiredTemplateKinds(templateKind)
  const forceTemplateRebuild = process.env.TEST_DB_REBUILD_TEMPLATES === '1'
  const fingerprints = Object.fromEntries(
    requiredTemplateKinds.map((requiredTemplateKind) => [
      requiredTemplateKind,
      computeTestDatabaseFingerprint({ templateKind: requiredTemplateKind }),
    ]),
  )
  const { adminConnectionString, connectionString, targetDatabaseName, templateDatabaseNames } = deriveDatabaseConfig(
    process.env.DATABASE_URI || DEFAULT_CONN,
  )

  if (forceTemplateRebuild) {
    console.log('♻️ TEST_DB_REBUILD_TEMPLATES=1 requested a clean template rebuild for this run.')
    runDockerCompose('reset')
  }

  console.log('🚀 Starting test database container...')
  runDockerCompose('up')
  console.log('⏳ Waiting for test database to be ready...')
  await waitForDatabase(adminConnectionString)
  await sleep(500)

  let templateStates = forceTemplateRebuild
    ? null
    : await inspectTemplateStatesForKinds({
        adminConnectionString,
        fingerprints,
        templateDatabaseNames,
        templateKinds: requiredTemplateKinds,
      })

  if (!templateStates) {
    templateStates = Object.fromEntries(
      requiredTemplateKinds.map((requiredTemplateKind) => [
        requiredTemplateKind,
        { current: false, exists: false, metadata: null },
      ]),
    )
  }

  if (requiredTemplateKinds.includes('empty') && !templateStates.empty?.current) {
    await ensureEmptyTemplate({
      adminConnectionString,
      fingerprint: fingerprints.empty,
      targetConnectionString: connectionString,
      templateDatabaseName: templateDatabaseNames.empty,
    })
    templateStates.empty = { current: true, exists: true, metadata: null }
  }

  if (requiredTemplateKinds.includes('baseline') && !templateStates.baseline?.current) {
    await ensureBaselineTemplate({
      adminConnectionString,
      emptyTemplateDatabaseName: templateDatabaseNames.empty,
      fingerprint: fingerprints.baseline,
      targetConnectionString: connectionString,
      templateDatabaseName: templateDatabaseNames.baseline,
    })
    templateStates.baseline = { current: true, exists: true, metadata: null }
  }

  console.log(`🧬 Restoring ${targetDatabaseName} from the ${templateKind} template...`)
  await rebuildWorkingDatabaseFromTemplate({
    adminConnectionString,
    targetDatabaseName,
    templateDatabaseName: templateDatabaseNames[templateKind],
  })

  console.log(`✅ Test database ready from ${templateKind} template in ${Date.now() - startedAt}ms`)
}

export async function teardownTestDatabase() {
  console.log('🧹 Stopping test database container (templates preserved)...')
  runDockerCompose('stop')
  console.log('✅ Test database container stopped and template volume preserved')
}
