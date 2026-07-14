#!/usr/bin/env node

import { createHmac } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const { Client } = pg

export const READ_ONLY_TRANSACTION_SQL = 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'
export const BASIC_USER_REFERENCE_QUERY = `
  SELECT
    tc.table_schema AS "tableSchema",
    tc.table_name AS "tableName",
    kcu.column_name AS "columnName",
    tc.constraint_name AS "constraintName"
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON kcu.constraint_schema = tc.constraint_schema
    AND kcu.constraint_name = tc.constraint_name
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_schema = tc.constraint_schema
    AND ccu.constraint_name = tc.constraint_name
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = current_schema()
    AND ccu.table_schema = current_schema()
    AND ccu.table_name = 'basic_users'
  ORDER BY tc.table_name, kcu.column_name, tc.constraint_name
`
const MINIMUM_DIGEST_KEY_LENGTH = 32
const NO_ALLOWED_UNBOUND_STAFF_STABLE_IDS = /** @type {string[]} */ ([])

const EXPANDED_COLUMNS = Object.freeze({
  clinic_staff: ['stable_id', 'supabase_user_id', 'email', 'first_name', 'last_name', 'profile_image_id'],
  platform_staff: ['stable_id', 'supabase_user_id', 'email', 'first_name', 'last_name', 'profile_image_id'],
})

export const BASIC_USER_RELATIONSHIP_CONTRACTS = Object.freeze({
  '_posts_v_rels.basic_users_id': {
    allowedUserTypes: ['platform'],
    classification: 'preserveVersionAuthors',
  },
  'clinic_applications.linked_records_basic_user_id': {
    allowedUserTypes: ['clinic'],
    classification: 'removeClinicApplicationLink',
  },
  'clinic_gallery_entries.created_by_id': {
    allowedUserTypes: ['clinic', 'platform'],
    classification: 'staffActor',
  },
  'clinic_gallery_media.created_by_id': {
    allowedUserTypes: ['clinic', 'platform'],
    classification: 'staffActor',
  },
  'clinic_media.created_by_id': {
    allowedUserTypes: ['clinic', 'platform'],
    classification: 'staffActor',
  },
  'clinic_staff.user_id': {
    allowedUserTypes: ['clinic'],
    classification: 'remapProfileLink',
  },
  'doctor_media.created_by_id': {
    allowedUserTypes: ['clinic', 'platform'],
    classification: 'staffActor',
  },
  'patient_clinic_inquiries.assigned_to_id': {
    allowedUserTypes: ['platform'],
    classification: 'platformOnly',
  },
  'payload_locked_documents_rels.basic_users_id': {
    allowedUserTypes: ['clinic', 'platform'],
    classification: 'clearLockedDocuments',
  },
  'payload_mcp_api_keys.user_id': {
    allowedUserTypes: ['platform'],
    classification: 'preserveMcpOwners',
  },
  'payload_preferences_rels.basic_users_id': {
    allowedUserTypes: ['clinic', 'platform'],
    classification: 'preservePreferences',
  },
  'platform_content_media.created_by_id': {
    allowedUserTypes: ['platform'],
    classification: 'platformOnly',
  },
  'platform_staff.user_id': {
    allowedUserTypes: ['platform'],
    classification: 'remapProfileLink',
  },
  'posts_rels.basic_users_id': {
    allowedUserTypes: ['platform'],
    classification: 'platformOnly',
  },
  'reviews.edited_by_id': {
    allowedUserTypes: ['platform'],
    classification: 'platformOnly',
  },
  'user_profile_media_rels.basic_users_id': {
    allowedUserTypes: ['clinic', 'platform'],
    classification: 'staffActor',
  },
})

const RELATIONSHIP_CLASSIFICATIONS = Object.freeze([
  'platformOnly',
  'staffActor',
  'remapProfileLink',
  'removeClinicApplicationLink',
  'preservePreferences',
  'preserveMcpOwners',
  'preserveVersionAuthors',
  'clearLockedDocuments',
])

function normalizeRecordId(value) {
  if (value === undefined || value === null || value === '') return null
  return String(value)
}

export function normalizeSupabaseId(value) {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function normalizeProjectedValue(value) {
  if (value === undefined || value === null || value === '') return null
  return String(value)
}

export function createHmacDigester(key) {
  if (typeof key !== 'string' || key.length < MINIMUM_DIGEST_KEY_LENGTH) {
    throw new Error(`STAFF_AUTH_PREFLIGHT_DIGEST_KEY must contain at least ${MINIMUM_DIGEST_KEY_LENGTH} characters`)
  }

  return (values) => {
    const normalized = [...values].map((value) => String(value)).sort()
    return createHmac('sha256', key).update(normalized.join('\n')).digest('hex')
  }
}

export function parseOptions(argv) {
  const options = {
    allowedUnboundStaffStableIds: [],
    requireExpandedSchema: false,
  }

  for (const arg of argv.filter((value) => value !== '--')) {
    if (arg === '--require-expanded-schema') {
      options.requireExpandedSchema = true
      continue
    }

    if (arg.startsWith('--allow-unbound-staff-stable-id=')) {
      const stableId = arg.slice('--allow-unbound-staff-stable-id='.length).trim()
      if (!stableId) throw new Error('--allow-unbound-staff-stable-id requires a nonempty value')
      options.allowedUnboundStaffStableIds.push(stableId)
      continue
    }

    throw new Error(`Unknown option: ${arg}`)
  }

  return options
}

function groupByUserId(rows) {
  const grouped = new Map()

  for (const row of rows) {
    const userId = normalizeRecordId(row.userId)
    if (!userId) continue
    const values = grouped.get(userId) ?? []
    values.push(row)
    grouped.set(userId, values)
  }

  return grouped
}

export function analyzeStaffProfiles({ basicUsers, clinicStaff, platformStaff }, digest) {
  const basicUserById = new Map(basicUsers.map((user) => [normalizeRecordId(user.id), user]))
  const clinicByUserId = groupByUserId(clinicStaff)
  const platformByUserId = groupByUserId(platformStaff)
  const issueKeys = []
  const inventoryKeys = [
    ...basicUsers.map(
      (user) => `basicUsers:${normalizeRecordId(user.id)}:${normalizeRecordId(user.stableId)}:${String(user.userType)}`,
    ),
    ...clinicStaff.map(
      (profile) =>
        `clinicStaff:${normalizeRecordId(profile.id)}:${normalizeRecordId(profile.userId)}:${normalizeRecordId(profile.stableId)}`,
    ),
    ...platformStaff.map(
      (profile) =>
        `platformStaff:${normalizeRecordId(profile.id)}:${normalizeRecordId(profile.userId)}:${normalizeRecordId(profile.stableId)}`,
    ),
  ]
  let ambiguousBasicUserCount = 0
  let clinicUserCount = 0
  let duplicateProfileLinkCount = 0
  let invalidUserTypeCount = 0
  let missingProfileCount = 0
  let platformUserCount = 0
  let profileTypeMismatchCount = 0

  for (const user of basicUsers) {
    const userId = normalizeRecordId(user.id)
    const clinicProfiles = clinicByUserId.get(userId) ?? []
    const platformProfiles = platformByUserId.get(userId) ?? []
    const expectedProfiles = user.userType === 'clinic' ? clinicProfiles : platformProfiles
    const unexpectedProfiles = user.userType === 'clinic' ? platformProfiles : clinicProfiles

    if (user.userType === 'clinic') clinicUserCount += 1
    else if (user.userType === 'platform') platformUserCount += 1
    else {
      invalidUserTypeCount += 1
      issueKeys.push(`invalid-basic-user-type:${userId}`)
    }

    if (expectedProfiles.length === 0) {
      missingProfileCount += 1
      issueKeys.push(`missing-profile:${userId}`)
    }

    if (expectedProfiles.length > 1) {
      duplicateProfileLinkCount += expectedProfiles.length - 1
      issueKeys.push(`duplicate-profile:${userId}`)
    }

    if (unexpectedProfiles.length > 0) {
      profileTypeMismatchCount += unexpectedProfiles.length
      issueKeys.push(`wrong-profile-type:${userId}`)
    }

    if (
      expectedProfiles.length !== 1 ||
      unexpectedProfiles.length > 0 ||
      !['clinic', 'platform'].includes(user.userType)
    ) {
      ambiguousBasicUserCount += 1
    }
  }

  let detachedProfileCount = 0
  for (const [collection, rows] of [
    ['clinicStaff', clinicStaff],
    ['platformStaff', platformStaff],
  ]) {
    for (const row of rows) {
      const userId = normalizeRecordId(row.userId)
      if (!userId || !basicUserById.has(userId)) {
        detachedProfileCount += 1
        issueKeys.push(`detached-profile:${collection}:${normalizeRecordId(row.id)}`)
      }
    }
  }

  return {
    ambiguousBasicUserCount,
    basicUserCount: basicUsers.length,
    clinicProfileCount: clinicStaff.length,
    clinicUserCount,
    detachedProfileCount,
    digest: digest([...inventoryKeys, ...issueKeys]),
    duplicateProfileLinkCount,
    invalidUserTypeCount,
    issueKeys,
    missingProfileCount,
    platformProfileCount: platformStaff.length,
    platformUserCount,
    profileTypeMismatchCount,
  }
}

function addIdentityOwner(groups, supabaseUserId, ownerKey, recordKey) {
  const normalized = normalizeSupabaseId(supabaseUserId)
  if (!normalized) return

  const entry = groups.get(normalized) ?? { owners: new Set(), recordKeys: [] }
  entry.owners.add(ownerKey)
  entry.recordKeys.push(recordKey)
  groups.set(normalized, entry)
}

export function analyzeIdentityUniqueness(
  { basicUsers, clinicStaff, patients, platformStaff },
  { allowedUnboundStaffStableIds = NO_ALLOWED_UNBOUND_STAFF_STABLE_IDS, digest },
) {
  const basicUserIds = new Set(basicUsers.map((user) => normalizeRecordId(user.id)).filter(Boolean))
  const allowedStableIds = new Set(allowedUnboundStaffStableIds)
  const matchedAllowedStableIds = new Set()
  const groups = new Map()
  const issueKeys = []
  const inventoryKeys = []
  let allowedUnboundStaffCount = 0
  let missingStaffSupabaseIdCount = 0
  let nonemptySupabaseIdCount = 0
  let unapprovedMissingStaffSupabaseIdCount = 0

  for (const user of basicUsers) {
    const userId = normalizeRecordId(user.id)
    const stableId = normalizeProjectedValue(user.stableId)
    const normalized = normalizeSupabaseId(user.supabaseUserId)
    inventoryKeys.push(`basicUsers:${userId}:${stableId}:${normalized}`)
    if (!normalized) {
      missingStaffSupabaseIdCount += 1
      if (stableId && allowedStableIds.has(stableId)) {
        allowedUnboundStaffCount += 1
        matchedAllowedStableIds.add(stableId)
      } else {
        unapprovedMissingStaffSupabaseIdCount += 1
        issueKeys.push(`missing-staff-supabase-id:basicUsers:${userId}:${stableId}`)
      }
    } else {
      nonemptySupabaseIdCount += 1
      addIdentityOwner(groups, normalized, `staff:${userId}`, `basicUsers:${userId}`)
    }
  }

  for (const patient of patients) {
    const patientId = normalizeRecordId(patient.id)
    inventoryKeys.push(`patients:${patientId}:${normalizeSupabaseId(patient.supabaseUserId)}`)
    if (normalizeSupabaseId(patient.supabaseUserId)) nonemptySupabaseIdCount += 1
    addIdentityOwner(groups, patient.supabaseUserId, `patient:${patientId}`, `patients:${patientId}`)
  }

  for (const [collection, rows] of [
    ['clinicStaff', clinicStaff],
    ['platformStaff', platformStaff],
  ]) {
    for (const row of rows) {
      const profileId = normalizeRecordId(row.id)
      const userId = normalizeRecordId(row.userId)
      const normalized = normalizeSupabaseId(row.supabaseUserId)
      inventoryKeys.push(`${collection}:${profileId}:${userId}:${normalizeProjectedValue(row.stableId)}:${normalized}`)
      if (!normalized) continue
      nonemptySupabaseIdCount += 1
      const ownerKey = userId && basicUserIds.has(userId) ? `staff:${userId}` : `${collection}:${profileId}`
      addIdentityOwner(groups, normalized, ownerKey, `${collection}:${profileId}`)
    }
  }

  let duplicateSupabaseIdCount = 0
  let duplicateSupabaseOwnerCount = 0
  for (const [supabaseUserId, entry] of groups) {
    if (entry.owners.size <= 1) continue
    duplicateSupabaseIdCount += 1
    duplicateSupabaseOwnerCount += entry.owners.size
    issueKeys.push(`duplicate-supabase-id:${supabaseUserId}:${entry.recordKeys.sort().join(',')}`)
  }

  const unusedAllowedStableIds = [...allowedStableIds].filter((stableId) => !matchedAllowedStableIds.has(stableId))
  for (const stableId of unusedAllowedStableIds) {
    issueKeys.push(`unused-unbound-staff-allowance:${stableId}`)
  }

  return {
    allowedUnboundStaffCount,
    digest: digest([...inventoryKeys, ...issueKeys]),
    duplicateSupabaseIdCount,
    duplicateSupabaseOwnerCount,
    issueKeys,
    missingStaffSupabaseIdCount,
    nonemptySupabaseIdCount,
    patientCount: patients.length,
    unapprovedMissingStaffSupabaseIdCount,
    unusedAllowedUnboundStaffStableIdCount: unusedAllowedStableIds.length,
  }
}

const COPIED_PROFILE_FIELDS = Object.freeze(['supabaseUserId', 'email', 'firstName', 'lastName', 'profileImageId'])

export function analyzeExpandedProjection({ basicUsers, clinicStaff, platformStaff }, digest) {
  const basicUserById = new Map(basicUsers.map((user) => [normalizeRecordId(user.id), user]))
  const fieldDriftCounts = Object.fromEntries(['stableId', ...COPIED_PROFILE_FIELDS].map((field) => [field, 0]))
  const issueKeys = []
  const inventoryKeys = []
  let checkedProfileCount = 0
  let driftedProfileCount = 0

  for (const [collection, rows] of [
    ['clinicStaff', clinicStaff],
    ['platformStaff', platformStaff],
  ]) {
    for (const profile of rows) {
      const profileId = normalizeRecordId(profile.id)
      const basicUser = basicUserById.get(normalizeRecordId(profile.userId))
      if (!basicUser) continue
      checkedProfileCount += 1
      let profileDrifted = false
      inventoryKeys.push(
        [
          collection,
          profileId,
          normalizeRecordId(profile.userId),
          normalizeProjectedValue(profile.stableId),
          ...COPIED_PROFILE_FIELDS.map((field) => normalizeProjectedValue(profile[field])),
        ].join(':'),
      )

      for (const field of COPIED_PROFILE_FIELDS) {
        if (normalizeProjectedValue(profile[field]) === normalizeProjectedValue(basicUser[field])) continue
        fieldDriftCounts[field] += 1
        profileDrifted = true
        issueKeys.push(`projection-drift:${collection}:${profileId}:${field}`)
      }

      const stableIdValid =
        collection === 'clinicStaff'
          ? normalizeProjectedValue(profile.stableId) === normalizeProjectedValue(basicUser.stableId)
          : normalizeProjectedValue(profile.stableId) !== null

      if (!stableIdValid) {
        fieldDriftCounts.stableId += 1
        profileDrifted = true
        issueKeys.push(`projection-drift:${collection}:${profileId}:stableId`)
      }

      if (profileDrifted) driftedProfileCount += 1
    }
  }

  return {
    checkedProfileCount,
    digest: digest([...inventoryKeys, ...issueKeys]),
    driftedProfileCount,
    fieldDriftCounts,
    issueKeys,
  }
}

export function classifyBasicUserReferences(references, digest) {
  const discoveredKeys = new Set(references.map((reference) => `${reference.tableName}.${reference.columnName}`))
  const expectedKeys = new Set(Object.keys(BASIC_USER_RELATIONSHIP_CONTRACTS))
  const missingExpectedKeys = [...expectedKeys].filter((key) => !discoveredKeys.has(key)).sort()
  const unknownKeys = [...discoveredKeys].filter((key) => !expectedKeys.has(key)).sort()

  const classified = references.map((reference) => {
    const key = `${reference.tableName}.${reference.columnName}`
    return {
      ...reference,
      contract: BASIC_USER_RELATIONSHIP_CONTRACTS[key] ?? null,
      key,
    }
  })

  return {
    classified,
    contractMismatchCount: missingExpectedKeys.length + unknownKeys.length,
    digest: digest([
      ...[...discoveredKeys].map((key) => `discovered:${key}`),
      ...missingExpectedKeys.map((key) => `missing:${key}`),
      ...unknownKeys.map((key) => `unknown:${key}`),
    ]),
    missingExpectedKeys,
    unknownKeys,
  }
}

export function analyzeRelationshipRows(classifiedReferences, digest) {
  const classIssueKeys = Object.fromEntries(RELATIONSHIP_CLASSIFICATIONS.map((classification) => [classification, []]))
  const classes = Object.fromEntries(
    RELATIONSHIP_CLASSIFICATIONS.map((classification) => [
      classification,
      {
        digest: digest([]),
        foreignKeyCount: 0,
        referencedRowCount: 0,
        semanticMismatchCount: 0,
      },
    ]),
  )
  const issueKeys = []
  const inventoryKeys = []
  let referencedRowCount = 0
  let semanticMismatchCount = 0

  for (const reference of classifiedReferences) {
    if (!reference.contract) continue
    const classSummary = classes[reference.contract.classification]
    classSummary.foreignKeyCount += 1
    classSummary.referencedRowCount += reference.rows.length
    referencedRowCount += reference.rows.length

    for (const row of reference.rows) {
      const inventoryKey = [
        reference.tableName,
        normalizeRecordId(row.sourceId),
        normalizeRecordId(row.basicUserId),
        String(row.userType),
      ].join(':')
      inventoryKeys.push(inventoryKey)
      classIssueKeys[reference.contract.classification].push(`inventory:${inventoryKey}`)
      if (reference.contract.allowedUserTypes.includes(row.userType)) continue
      semanticMismatchCount += 1
      classSummary.semanticMismatchCount += 1
      const issueKey = `${reference.key}:${normalizeRecordId(row.basicUserId)}:${String(row.userType)}`
      issueKeys.push(issueKey)
      classIssueKeys[reference.contract.classification].push(issueKey)
    }
  }

  for (const classification of RELATIONSHIP_CLASSIFICATIONS) {
    classes[classification].digest = digest(classIssueKeys[classification])
  }

  return {
    classes,
    digest: digest([...inventoryKeys, ...issueKeys]),
    issueKeys,
    referencedRowCount,
    semanticMismatchCount,
  }
}

export function evaluateExpandedSchema(columnsByTable, digest) {
  const missingColumnKeys = []

  for (const [tableName, requiredColumns] of Object.entries(EXPANDED_COLUMNS)) {
    const columns = columnsByTable.get(tableName) ?? new Set()
    for (const columnName of requiredColumns) {
      if (!columns.has(columnName)) missingColumnKeys.push(`${tableName}.${columnName}`)
    }
  }

  return {
    complete: missingColumnKeys.length === 0,
    digest: digest([
      ...[...columnsByTable.entries()].flatMap(([tableName, columns]) =>
        [...columns].map((columnName) => `${tableName}.${columnName}`),
      ),
      ...missingColumnKeys.map((key) => `missing:${key}`),
    ]),
    missingColumnCount: missingColumnKeys.length,
    missingColumnKeys,
  }
}

export function buildPreflightSummary({
  digest,
  expandedProjection,
  expandedSchema,
  identityAnalysis,
  options,
  profileAnalysis,
  relationshipClassification,
  relationshipRows,
}) {
  const expandedSchemaFailure = options.requireExpandedSchema && !expandedSchema.complete
  const staffSupabaseFailure =
    identityAnalysis.unapprovedMissingStaffSupabaseIdCount > 0 ||
    identityAnalysis.unusedAllowedUnboundStaffStableIdCount > 0
  const projectionFailure = expandedSchema.complete && expandedProjection.driftedProfileCount > 0
  const passed =
    profileAnalysis.ambiguousBasicUserCount === 0 &&
    profileAnalysis.detachedProfileCount === 0 &&
    identityAnalysis.duplicateSupabaseIdCount === 0 &&
    relationshipClassification.contractMismatchCount === 0 &&
    relationshipRows.semanticMismatchCount === 0 &&
    !expandedSchemaFailure &&
    !staffSupabaseFailure &&
    !projectionFailure

  return {
    identities: {
      allowedUnboundStaffCount: identityAnalysis.allowedUnboundStaffCount,
      basicUserCount: profileAnalysis.basicUserCount,
      clinicProfileCount: profileAnalysis.clinicProfileCount,
      clinicUserCount: profileAnalysis.clinicUserCount,
      detachedProfileCount: profileAnalysis.detachedProfileCount,
      digest: digest([profileAnalysis.digest, identityAnalysis.digest]),
      duplicateProfileLinkCount: profileAnalysis.duplicateProfileLinkCount,
      duplicateSupabaseIdCount: identityAnalysis.duplicateSupabaseIdCount,
      duplicateSupabaseOwnerCount: identityAnalysis.duplicateSupabaseOwnerCount,
      invalidUserTypeCount: profileAnalysis.invalidUserTypeCount,
      missingProfileCount: profileAnalysis.missingProfileCount,
      missingStaffSupabaseIdCount: identityAnalysis.missingStaffSupabaseIdCount,
      nonemptySupabaseIdCount: identityAnalysis.nonemptySupabaseIdCount,
      patientCount: identityAnalysis.patientCount,
      platformProfileCount: profileAnalysis.platformProfileCount,
      platformUserCount: profileAnalysis.platformUserCount,
      profileTypeMismatchCount: profileAnalysis.profileTypeMismatchCount,
      unapprovedMissingStaffSupabaseIdCount: identityAnalysis.unapprovedMissingStaffSupabaseIdCount,
      unusedAllowedUnboundStaffStableIdCount: identityAnalysis.unusedAllowedUnboundStaffStableIdCount,
    },
    options: {
      allowedUnboundStaffStableIdCount: new Set(options.allowedUnboundStaffStableIds).size,
      digest: digest(options.allowedUnboundStaffStableIds),
      requireExpandedSchema: options.requireExpandedSchema,
    },
    passed,
    projection: {
      checked: expandedSchema.complete,
      checkedProfileCount: expandedProjection.checkedProfileCount,
      digest: expandedProjection.digest,
      driftedProfileCount: expandedProjection.driftedProfileCount,
      fieldDriftCounts: expandedProjection.fieldDriftCounts,
    },
    relationships: {
      classes: relationshipRows.classes,
      contractDigest: relationshipClassification.digest,
      contractMismatchCount: relationshipClassification.contractMismatchCount,
      digest: relationshipRows.digest,
      discoveredForeignKeyCount: relationshipClassification.classified.length,
      expectedForeignKeyCount: Object.keys(BASIC_USER_RELATIONSHIP_CONTRACTS).length,
      referencedRowCount: relationshipRows.referencedRowCount,
      semanticMismatchCount: relationshipRows.semanticMismatchCount,
    },
    schema: {
      digest: expandedSchema.digest,
      expandedSchemaComplete: expandedSchema.complete,
      missingExpandedColumnCount: expandedSchema.missingColumnCount,
    },
    version: 1,
  }
}

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`
}

function selectOptionalColumn(columns, tableAlias, columnName, resultName) {
  if (!columns.has(columnName)) return `NULL::text AS ${quoteIdentifier(resultName)}`
  return `${tableAlias}.${quoteIdentifier(columnName)}::text AS ${quoteIdentifier(resultName)}`
}

export function buildReferenceInventoryQuery(reference) {
  return `
      SELECT
        source.id::text AS "sourceId",
        source.${quoteIdentifier(reference.columnName)}::text AS "basicUserId",
        bu.user_type::text AS "userType"
      FROM ${quoteIdentifier(reference.tableSchema)}.${quoteIdentifier(reference.tableName)} source
      JOIN basic_users bu ON bu.id = source.${quoteIdentifier(reference.columnName)}
      WHERE source.${quoteIdentifier(reference.columnName)} IS NOT NULL
      ORDER BY source.id, source.${quoteIdentifier(reference.columnName)}
    `
}

async function readColumns(client) {
  const result = await client.query(
    `
    SELECT table_name AS "tableName", column_name AS "columnName"
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = ANY($1::text[])
  `,
    [['basic_users', 'clinic_staff', 'patients', 'platform_staff']],
  )
  const columnsByTable = new Map()

  for (const row of result.rows) {
    const columns = columnsByTable.get(row.tableName) ?? new Set()
    columns.add(row.columnName)
    columnsByTable.set(row.tableName, columns)
  }

  return columnsByTable
}

async function readIdentityRows(client, columnsByTable) {
  const basicColumns = columnsByTable.get('basic_users') ?? new Set()
  const clinicColumns = columnsByTable.get('clinic_staff') ?? new Set()
  const patientColumns = columnsByTable.get('patients') ?? new Set()
  const platformColumns = columnsByTable.get('platform_staff') ?? new Set()

  const basicUsers = await client.query(`
      SELECT
        bu.id::text AS "id",
        ${selectOptionalColumn(basicColumns, 'bu', 'stable_id', 'stableId')},
        ${selectOptionalColumn(basicColumns, 'bu', 'supabase_user_id', 'supabaseUserId')},
        ${selectOptionalColumn(basicColumns, 'bu', 'email', 'email')},
        ${selectOptionalColumn(basicColumns, 'bu', 'first_name', 'firstName')},
        ${selectOptionalColumn(basicColumns, 'bu', 'last_name', 'lastName')},
        ${selectOptionalColumn(basicColumns, 'bu', 'profile_image_id', 'profileImageId')},
        bu.user_type::text AS "userType"
      FROM basic_users bu
      ORDER BY bu.id
    `)
  const clinicStaff = await client.query(`
      SELECT
        cs.id::text AS "id",
        cs.user_id::text AS "userId",
        ${selectOptionalColumn(clinicColumns, 'cs', 'stable_id', 'stableId')},
        ${selectOptionalColumn(clinicColumns, 'cs', 'supabase_user_id', 'supabaseUserId')},
        ${selectOptionalColumn(clinicColumns, 'cs', 'email', 'email')},
        ${selectOptionalColumn(clinicColumns, 'cs', 'first_name', 'firstName')},
        ${selectOptionalColumn(clinicColumns, 'cs', 'last_name', 'lastName')},
        ${selectOptionalColumn(clinicColumns, 'cs', 'profile_image_id', 'profileImageId')}
      FROM clinic_staff cs
      ORDER BY cs.id
    `)
  const patients = await client.query(`
      SELECT
        p.id::text AS "id",
        ${selectOptionalColumn(patientColumns, 'p', 'supabase_user_id', 'supabaseUserId')}
      FROM patients p
      ORDER BY p.id
    `)
  const platformStaff = await client.query(`
      SELECT
        ps.id::text AS "id",
        ps.user_id::text AS "userId",
        ${selectOptionalColumn(platformColumns, 'ps', 'stable_id', 'stableId')},
        ${selectOptionalColumn(platformColumns, 'ps', 'supabase_user_id', 'supabaseUserId')},
        ${selectOptionalColumn(platformColumns, 'ps', 'email', 'email')},
        ${selectOptionalColumn(platformColumns, 'ps', 'first_name', 'firstName')},
        ${selectOptionalColumn(platformColumns, 'ps', 'last_name', 'lastName')},
        ${selectOptionalColumn(platformColumns, 'ps', 'profile_image_id', 'profileImageId')}
      FROM platform_staff ps
      ORDER BY ps.id
    `)

  return {
    basicUsers: basicUsers.rows,
    clinicStaff: clinicStaff.rows,
    patients: patients.rows,
    platformStaff: platformStaff.rows,
  }
}

async function readBasicUserReferences(client, digest) {
  const referencesResult = await client.query(BASIC_USER_REFERENCE_QUERY)
  const classification = classifyBasicUserReferences(referencesResult.rows, digest)

  for (const reference of classification.classified) {
    const result = await client.query(buildReferenceInventoryQuery(reference))
    reference.rows = result.rows
  }

  return classification
}

export async function runPreflight({ connectionString, digest, options }) {
  const client = new Client({
    application_name: 'staff-auth-preflight',
    connectionString,
  })
  await client.connect()

  try {
    await client.query(READ_ONLY_TRANSACTION_SQL)
    const columnsByTable = await readColumns(client)
    const expandedSchema = evaluateExpandedSchema(columnsByTable, digest)
    const identities = await readIdentityRows(client, columnsByTable)
    const profileAnalysis = analyzeStaffProfiles(identities, digest)
    const identityAnalysis = analyzeIdentityUniqueness(identities, {
      allowedUnboundStaffStableIds: options.allowedUnboundStaffStableIds,
      digest,
    })
    const expandedProjection = expandedSchema.complete
      ? analyzeExpandedProjection(identities, digest)
      : {
          checkedProfileCount: 0,
          digest: digest([]),
          driftedProfileCount: 0,
          fieldDriftCounts: Object.fromEntries(['stableId', ...COPIED_PROFILE_FIELDS].map((field) => [field, 0])),
        }
    const relationshipClassification = await readBasicUserReferences(client, digest)
    const relationshipRows = analyzeRelationshipRows(relationshipClassification.classified, digest)

    return buildPreflightSummary({
      digest,
      expandedProjection,
      expandedSchema,
      identityAnalysis,
      options,
      profileAnalysis,
      relationshipClassification,
      relationshipRows,
    })
  } finally {
    await client.query('ROLLBACK').catch(() => undefined)
    await client.end()
  }
}

async function main() {
  const options = parseOptions(process.argv.slice(2))
  const connectionString = process.env.DATABASE_URI
  if (!connectionString) throw new Error('DATABASE_URI is required')
  const digest = createHmacDigester(process.env.STAFF_AUTH_PREFLIGHT_DIGEST_KEY)

  const summary = await runPreflight({ connectionString, digest, options })
  console.log(JSON.stringify(summary, null, 2))
  if (!summary.passed) process.exitCode = 1
}

const isDirectExecution = process.argv[1] ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false

if (isDirectExecution) {
  main().catch(() => {
    console.error(JSON.stringify({ failed: true, passed: false }))
    process.exitCode = 1
  })
}
