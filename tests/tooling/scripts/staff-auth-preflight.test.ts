import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'

import {
  analyzeExpandedProjection,
  analyzeIdentityUniqueness,
  analyzeRelationshipRows,
  analyzeStaffProfiles,
  BASIC_USER_REFERENCE_QUERY,
  BASIC_USER_RELATIONSHIP_CONTRACTS,
  buildReferenceInventoryQuery,
  buildPreflightSummary,
  classifyBasicUserReferences,
  createHmacDigester,
  evaluateExpandedSchema,
  normalizeSupabaseId,
  parseOptions,
  READ_ONLY_TRANSACTION_SQL,
} from '../../../scripts/staff-auth-preflight.mjs'

const TEST_DIGEST_KEY = 'staff-auth-preflight-test-key-0000000000000000'
const digest = createHmacDigester(TEST_DIGEST_KEY)

type ClassifiedReference = {
  columnName: string
  contract: null | { allowedUserTypes: string[]; classification: string }
  key: string
  tableName: string
  tableSchema: string
}

const basicUsers = [
  {
    email: 'platform@example.test',
    firstName: 'Platform',
    id: '1',
    lastName: 'User',
    profileImageId: '11',
    stableId: 'basic-platform',
    supabaseUserId: 'supabase-platform',
    userType: 'platform',
  },
  {
    email: 'clinic@example.test',
    firstName: 'Clinic',
    id: '2',
    lastName: 'User',
    profileImageId: null,
    stableId: 'basic-clinic',
    supabaseUserId: 'supabase-clinic',
    userType: 'clinic',
  },
]

const platformStaff = [
  {
    ...basicUsers[0],
    id: '101',
    stableId: 'platform-profile',
    userId: '1',
  },
]

const clinicStaff = [
  {
    ...basicUsers[1],
    id: '102',
    userId: '2',
  },
]

function allExpectedReferences() {
  return Object.keys(BASIC_USER_RELATIONSHIP_CONTRACTS).map((key) => {
    const separator = key.lastIndexOf('.')
    return {
      columnName: key.slice(separator + 1),
      constraintName: `${key}-fk`,
      tableName: key.slice(0, separator),
      tableSchema: 'public',
    }
  })
}

describe('staff auth preflight options', () => {
  it('parses strict rollout flags and ignores the pnpm separator', () => {
    expect(
      parseOptions([
        '--',
        '--require-expanded-schema',
        '--allow-unbound-staff-stable-id=seed-one',
        '--allow-unbound-staff-stable-id=seed-two',
      ]),
    ).toEqual({
      allowedUnboundStaffStableIds: ['seed-one', 'seed-two'],
      requireExpandedSchema: true,
    })
  })

  it('normalizes only nonempty Supabase IDs and creates keyed HMAC digests', () => {
    expect(normalizeSupabaseId('  identity-id ')).toBe('identity-id')
    expect(normalizeSupabaseId('   ')).toBeNull()
    expect(digest(['b', 'a'])).toBe(createHmac('sha256', TEST_DIGEST_KEY).update('a\nb').digest('hex'))
    expect(digest(['b', 'a'])).toBe(digest(['a', 'b']))
    expect(createHmacDigester(`${TEST_DIGEST_KEY}-other`)(['a', 'b'])).not.toBe(digest(['a', 'b']))
    expect(() => createHmacDigester('too-short')).toThrow(/at least 32 characters/)
  })

  it('uses a repeatable-read, read-only transaction', () => {
    expect(READ_ONLY_TRANSACTION_SQL).toBe('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
  })
})

describe('staff profile inventory', () => {
  it('accepts one type-matching profile per staff identity', () => {
    const result = analyzeStaffProfiles({ basicUsers, clinicStaff, platformStaff }, digest)

    expect(result).toMatchObject({
      ambiguousBasicUserCount: 0,
      detachedProfileCount: 0,
      duplicateProfileLinkCount: 0,
      missingProfileCount: 0,
      profileTypeMismatchCount: 0,
    })
    expect(result.digest).toMatch(/^[a-f0-9]{64}$/)
    expect(
      analyzeStaffProfiles(
        { basicUsers, clinicStaff, platformStaff: [{ ...platformStaff[0], id: 'different-profile' }] },
        digest,
      ).digest,
    ).not.toBe(result.digest)
  })

  it('blocks missing, duplicate, detached, and type-mismatched profile links', () => {
    const result = analyzeStaffProfiles(
      {
        basicUsers,
        clinicStaff: [
          clinicStaff[0],
          { ...clinicStaff[0], id: '103' },
          { ...clinicStaff[0], id: '104', userId: 'missing' },
        ],
        platformStaff: [{ ...platformStaff[0], userId: '2' }],
      },
      digest,
    )

    expect(result).toMatchObject({
      ambiguousBasicUserCount: 2,
      detachedProfileCount: 1,
      duplicateProfileLinkCount: 1,
      missingProfileCount: 1,
      profileTypeMismatchCount: 1,
    })
  })
})

describe('cross-collection identity inventory', () => {
  it('allows a direct profile to mirror its linked BasicUser identity', () => {
    const result = analyzeIdentityUniqueness(
      {
        basicUsers,
        clinicStaff,
        patients: [{ id: '201', supabaseUserId: 'supabase-patient' }],
        platformStaff,
      },
      { digest },
    )

    expect(result).toMatchObject({
      duplicateSupabaseIdCount: 0,
      missingStaffSupabaseIdCount: 0,
    })
    expect(result.digest).toMatch(/^[a-f0-9]{64}$/)
    const changedInventory = analyzeIdentityUniqueness(
      {
        basicUsers,
        clinicStaff,
        patients: [{ id: 'different-patient', supabaseUserId: 'supabase-patient' }],
        platformStaff,
      },
      { digest },
    )
    expect(changedInventory.digest).not.toBe(result.digest)
  })

  it('detects an identity shared by independent owners and missing staff identities', () => {
    const result = analyzeIdentityUniqueness(
      {
        basicUsers: [{ ...basicUsers[0], supabaseUserId: null }],
        clinicStaff: [],
        patients: [
          { id: '201', supabaseUserId: 'shared' },
          { id: '202', supabaseUserId: 'shared' },
        ],
        platformStaff: [],
      },
      { digest },
    )

    expect(result).toMatchObject({
      duplicateSupabaseIdCount: 1,
      duplicateSupabaseOwnerCount: 2,
      missingStaffSupabaseIdCount: 1,
      unapprovedMissingStaffSupabaseIdCount: 1,
    })
  })

  it('allows only explicitly named unbound staff stable IDs and detects unused allowances', () => {
    const unboundBasicUser = { ...basicUsers[0], supabaseUserId: null }
    const unboundPlatformProfile = { ...platformStaff[0], supabaseUserId: null }
    const allowed = analyzeIdentityUniqueness(
      {
        basicUsers: [unboundBasicUser],
        clinicStaff: [],
        patients: [],
        platformStaff: [unboundPlatformProfile],
      },
      { allowedUnboundStaffStableIds: ['basic-platform'], digest },
    )

    expect(allowed).toMatchObject({
      allowedUnboundStaffCount: 1,
      missingStaffSupabaseIdCount: 1,
      unapprovedMissingStaffSupabaseIdCount: 0,
      unusedAllowedUnboundStaffStableIdCount: 0,
    })

    const unused = analyzeIdentityUniqueness(
      {
        basicUsers: [unboundBasicUser],
        clinicStaff: [],
        patients: [],
        platformStaff: [unboundPlatformProfile],
      },
      { allowedUnboundStaffStableIds: ['different-stable-id'], digest },
    )
    expect(unused).toMatchObject({
      unapprovedMissingStaffSupabaseIdCount: 1,
      unusedAllowedUnboundStaffStableIdCount: 1,
    })
  })
})

describe('expanded identity projection', () => {
  it('keeps the platform profile stable ID and mirrors the clinic identity stable ID', () => {
    const result = analyzeExpandedProjection({ basicUsers, clinicStaff, platformStaff }, digest)

    expect(result).toMatchObject({
      checkedProfileCount: 2,
      driftedProfileCount: 0,
    })
  })

  it('detects copied field and clinic stable ID drift', () => {
    const result = analyzeExpandedProjection(
      {
        basicUsers,
        clinicStaff: [{ ...clinicStaff[0], email: 'drift@example.test', stableId: 'wrong' }],
        platformStaff,
      },
      digest,
    )

    expect(result.driftedProfileCount).toBe(1)
    expect(result.fieldDriftCounts).toMatchObject({ email: 1, stableId: 1 })
  })
})

describe('BasicUser relationship contracts', () => {
  it('recognizes the complete expected foreign-key inventory', () => {
    const result = classifyBasicUserReferences(allExpectedReferences(), digest)

    expect(result).toMatchObject({
      contractMismatchCount: 0,
      missingExpectedKeys: [],
      unknownKeys: [],
    })
  })

  it('blocks unknown and missing foreign-key contracts', () => {
    const references = allExpectedReferences().slice(1)
    references.push({
      columnName: 'owner_id',
      constraintName: 'unknown-fk',
      tableName: 'unknown_table',
      tableSchema: 'public',
    })

    const result = classifyBasicUserReferences(references, digest)

    expect(result.contractMismatchCount).toBe(2)
    expect(result.missingExpectedKeys).toHaveLength(1)
    expect(result.unknownKeys).toEqual(['unknown_table.owner_id'])
  })

  it('blocks rows whose identity type cannot be remapped to the contract target', () => {
    const classification = classifyBasicUserReferences(allExpectedReferences(), digest)
    const references = classification.classified.map((reference: ClassifiedReference) => ({
      ...reference,
      rows:
        reference.key === 'posts_rels.basic_users_id'
          ? [{ basicUserId: '2', sourceId: 'post-rel-1', userType: 'clinic' }]
          : [],
    }))

    const result = analyzeRelationshipRows(references, digest)

    expect(result.semanticMismatchCount).toBe(1)
    expect(result.classes.platformOnly).toMatchObject({
      referencedRowCount: 1,
      semanticMismatchCount: 1,
    })
    expect(result.digest).toBe(digest(['posts_rels:post-rel-1:2:clinic', 'posts_rels.basic_users_id:2:clinic']))
  })

  it('selects the relation source ID for the keyed inventory digest', () => {
    const query = buildReferenceInventoryQuery({
      columnName: 'basic_users_id',
      tableName: 'posts_rels',
      tableSchema: 'public',
    })

    expect(query).toContain('source.id::text AS "sourceId"')
    expect(query).toContain('ORDER BY source.id')
  })

  it('limits both sides of the foreign-key inventory to the active schema', () => {
    expect(BASIC_USER_REFERENCE_QUERY).toContain('tc.table_schema = current_schema()')
    expect(BASIC_USER_REFERENCE_QUERY).toContain('ccu.table_schema = current_schema()')
  })
})

describe('preflight rollout gates', () => {
  it('fails unbound staff by default and passes only the matching stable-ID allowance', () => {
    const unboundBasicUser = { ...basicUsers[0], supabaseUserId: null }
    const unboundPlatformProfile = { ...platformStaff[0], supabaseUserId: null }
    const expandedSchema = evaluateExpandedSchema(new Map(), digest)
    const relationshipClassification = classifyBasicUserReferences(allExpectedReferences(), digest)
    const relationshipRows = analyzeRelationshipRows(
      relationshipClassification.classified.map((reference: ClassifiedReference) => ({
        ...reference,
        rows: [],
      })),
      digest,
    )
    const profileAnalysis = analyzeStaffProfiles(
      { basicUsers: [unboundBasicUser], clinicStaff: [], platformStaff: [unboundPlatformProfile] },
      digest,
    )
    const summarize = (allowedUnboundStaffStableIds: string[]) =>
      buildPreflightSummary({
        digest,
        expandedProjection: {
          checkedProfileCount: 0,
          digest: digest([]),
          driftedProfileCount: 0,
          fieldDriftCounts: {},
        },
        expandedSchema,
        identityAnalysis: analyzeIdentityUniqueness(
          {
            basicUsers: [unboundBasicUser],
            clinicStaff: [],
            patients: [],
            platformStaff: [unboundPlatformProfile],
          },
          { allowedUnboundStaffStableIds, digest },
        ),
        options: { allowedUnboundStaffStableIds, requireExpandedSchema: false },
        profileAnalysis,
        relationshipClassification,
        relationshipRows,
      })

    expect(summarize([]).passed).toBe(false)
    const allowedSummary = summarize(['basic-platform'])
    expect(allowedSummary.passed).toBe(true)
    expect(JSON.stringify(allowedSummary)).not.toContain('basic-platform')
  })

  it('fails the strict expanded-schema and staff-identity gates', () => {
    const expandedSchema = evaluateExpandedSchema(
      new Map([
        ['clinic_staff', new Set(['stable_id'])],
        ['platform_staff', new Set(['stable_id'])],
      ]),
      digest,
    )
    const relationshipClassification = classifyBasicUserReferences(allExpectedReferences(), digest)
    const relationshipRows = analyzeRelationshipRows(
      relationshipClassification.classified.map((reference: ClassifiedReference) => ({
        ...reference,
        rows: [],
      })),
      digest,
    )
    const profileAnalysis = analyzeStaffProfiles(
      {
        basicUsers: [{ ...basicUsers[0], supabaseUserId: null }],
        clinicStaff: [],
        platformStaff,
      },
      digest,
    )
    const identityAnalysis = analyzeIdentityUniqueness(
      {
        basicUsers: [{ ...basicUsers[0], supabaseUserId: null }],
        clinicStaff: [],
        patients: [],
        platformStaff: [{ ...platformStaff[0], supabaseUserId: null }],
      },
      { digest },
    )

    const summary = buildPreflightSummary({
      digest,
      expandedProjection: {
        checkedProfileCount: 0,
        digest: digest([]),
        driftedProfileCount: 0,
        fieldDriftCounts: {},
      },
      expandedSchema,
      identityAnalysis,
      options: { allowedUnboundStaffStableIds: [], requireExpandedSchema: true },
      profileAnalysis,
      relationshipClassification,
      relationshipRows,
    })

    expect(summary).toMatchObject({
      passed: false,
      schema: { expandedSchemaComplete: false },
    })
    const serialized = JSON.stringify(summary)
    expect(serialized).not.toContain('platform@example.test')
    expect(serialized).not.toContain('supabase-platform')
    expect(serialized).not.toContain('basic-platform')
  })
})
