import { expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Access, AccessArgs } from 'payload'
import { mockUsers } from '../helpers/mockUsers'
import { createMockReq, type MockRequest, type TestUser } from '../helpers/testHelpers'

export interface AccessExpectation {
  type: 'platform' | 'anyone' | 'published' | 'conditional'
  details?: string
}

export interface MatrixRow {
  slug: string
  displayName: string
  operations: {
    create: AccessExpectation
    read: AccessExpectation
    update: AccessExpectation
    delete: AccessExpectation
    admin?: AccessExpectation
    readVersions?: AccessExpectation
  }
  notes?: string
  meta?: CollectionMeta
}

export interface PermissionMatrix {
  version: string
  source: string
  collections: Record<string, MatrixRow>
}

export type Operation = keyof MatrixRow['operations']

export type ConditionalScenarioKind =
  | 'always-false'
  | 'clinic-approved'
  | 'clinic-scope'
  | 'clinic-staff-update'
  | 'patient-scope'
  | 'patient-update-self'
  | 'role-allow'
  | 'clinic-media-create'
  | 'doctor-media-create'
  | 'user-profile-media-own'
  | 'user-profile-media-create'
  | 'clinic-gallery-read'

export interface ConditionalScenarioMeta {
  kind: ConditionalScenarioKind
  path?: string
  value?: string
  allow?: UserType[]
  statusPath?: string
}

export interface PublishedMeta {
  field?: string
  value?: string
  filters?: Partial<Record<UserType, unknown>>
}

export interface CollectionMeta {
  published?: PublishedMeta
  conditional?: Partial<Record<Operation, ConditionalScenarioMeta>>
}

export type UserType = 'platform' | 'clinic' | 'patient' | 'anonymous'

export type UserMatrixEntry = [
  string,
  (
    | ReturnType<typeof mockUsers.platform>
    | ReturnType<typeof mockUsers.clinic>
    | ReturnType<typeof mockUsers.patient>
    | null
  ),
  UserType,
]

export function buildUserMatrix(): UserMatrixEntry[] {
  return [
    ['platform staff', mockUsers.platform(), 'platform'],
    ['clinic staff', mockUsers.clinic(), 'clinic'],
    ['patient', mockUsers.patient(), 'patient'],
    ['anonymous', mockUsers.anonymous(), 'anonymous'],
  ]
}

export type AccessFn = Access

function buildAccessArgs(req: MockRequest, operationArgs?: OperationArgs): AccessArgs {
  const args: AccessArgs = { req }
  if (operationArgs?.data !== undefined) args.data = operationArgs.data
  if (operationArgs?.id !== undefined) args.id = operationArgs.id
  return args
}

export function createMatrixAccessTest(
  collectionSlug: MatrixRow['slug'],
  operation: Operation,
  accessFn: AccessFn,
  expectation: AccessExpectation,
) {
  return async (_description: string, user: TestUser, userType: UserType) => {
    const req = createMockReq(user)
    const operationArgs = buildOperationArgs(collectionSlug, operation, userType, user)
    const accessArgs = buildAccessArgs(req, operationArgs)
    const result = await accessFn(accessArgs)

    await validateAccessResult({
      collectionSlug,
      operation,
      expectation,
      userType,
      user,
      result,
      req,
      args: operationArgs,
    })
  }
}

export function buildOperationArgs(
  collectionSlug: string,
  operation: Operation,
  userType: UserType,
  user: TestUser,
): OperationArgs | undefined {
  if (collectionSlug === 'patients' && operation === 'update') {
    if (userType === 'patient') {
      const id = typeof (user as { id?: unknown })?.id === 'number' ? (user as { id: number }).id : 1
      return { id }
    }
    return { id: 2 }
  }

  if (collectionSlug === 'clinicMedia' && operation === 'create') {
    const clinicId = getClinicIdFromUser(user)
    return {
      data: {
        clinic: clinicId ?? 1,
      },
    }
  }

  if (collectionSlug === 'userProfileMedia' && operation === 'create') {
    if (userType === 'clinic') {
      return { data: { user: { relationTo: 'basicUsers', value: user?.id ?? 1 } } }
    }

    if (userType === 'patient') {
      return { data: { user: { relationTo: 'patients', value: user?.id ?? 1 } } }
    }

    return { data: { user: { relationTo: 'basicUsers', value: 1 } } }
  }

  if (collectionSlug === 'clinicGalleryMedia' && operation === 'create') {
    const clinicId = getClinicIdFromUser(user)
    return {
      data: {
        clinic: clinicId ?? 1,
      },
    }
  }

  if (collectionSlug === 'clinicGalleryEntries' && operation === 'create') {
    const clinicId = getClinicIdFromUser(user)
    return {
      data: {
        clinic: clinicId ?? 1,
      },
    }
  }

  return undefined
}

export interface ValidationContext {
  collectionSlug: string
  operation: Operation
  expectation: AccessExpectation
  userType: UserType
  user: TestUser
  result: unknown
  req: MockRequest
  args?: OperationArgs
}

export interface OperationArgs {
  id?: number
  data?: {
    clinic?: unknown
    user?: unknown
    [key: string]: unknown
  }
}

let _matrix: PermissionMatrix | null = null

/**
 * Load the permission matrix from JSON file
 */
export function getMatrix(): PermissionMatrix {
  if (!_matrix) {
    const tmpPath = resolve(process.cwd(), 'tmp/permission-matrix.json')
    if (!existsSync(tmpPath)) {
      throw new Error(`Permission matrix JSON not found at ${tmpPath}. Ensure unit test setup generated it.`)
    }
    _matrix = JSON.parse(readFileSync(tmpPath, 'utf8'))
  }
  return _matrix!
}

/**
 * Get matrix row for a collection
 */
export function getMatrixRow(collectionSlug: string): MatrixRow {
  const matrix = getMatrix()
  const row = matrix.collections[collectionSlug]
  if (!row) {
    throw new Error(`No matrix row found for collection: ${collectionSlug}`)
  }
  return row
}

type ConditionalScenario =
  | { kind: 'always-false' }
  | { kind: 'clinic-approved'; path: string; value: string }
  | { kind: 'clinic-scope'; path: string }
  | { kind: 'clinic-staff-update'; path: string }
  | { kind: 'patient-scope'; path: string }
  | { kind: 'patient-update-self' }
  | { kind: 'role-allow'; allow: UserType[] }
  | { kind: 'clinic-media-create' }
  | { kind: 'doctor-media-create' }
  | { kind: 'user-profile-media-own' }
  | { kind: 'user-profile-media-create' }
  | { kind: 'clinic-gallery-read'; path: string; status?: string; statusField?: string }
function getCollectionMeta(collectionSlug: string): CollectionMeta | undefined {
  return getMatrixRow(collectionSlug).meta
}

function getPublishedMeta(collectionSlug: string): PublishedMeta | undefined {
  return getCollectionMeta(collectionSlug)?.published
}

function scenarioFromMeta(collectionSlug: string, operation: Operation): ConditionalScenario | undefined {
  const config = getCollectionMeta(collectionSlug)?.conditional?.[operation]
  if (!config) return undefined

  return ensureScenarioDefaults(convertMetaToScenario(config))
}

function convertMetaToScenario(config: ConditionalScenarioMeta): ConditionalScenario {
  switch (config.kind) {
    case 'clinic-approved':
      return { kind: 'clinic-approved', path: config.path ?? 'status', value: config.value ?? 'approved' }
    case 'clinic-scope':
      return { kind: 'clinic-scope', path: config.path ?? 'clinic' }
    case 'clinic-staff-update':
      return { kind: 'clinic-staff-update', path: config.path ?? 'user' }
    case 'patient-scope':
      return { kind: 'patient-scope', path: config.path ?? 'patient' }
    case 'patient-update-self':
      return { kind: 'patient-update-self' }
    case 'role-allow':
      return { kind: 'role-allow', allow: config.allow ?? [] }
    case 'clinic-media-create':
      return { kind: 'clinic-media-create' }
    case 'doctor-media-create':
      return { kind: 'doctor-media-create' }
    case 'user-profile-media-own':
      return { kind: 'user-profile-media-own' }
    case 'user-profile-media-create':
      return { kind: 'user-profile-media-create' }
    case 'clinic-gallery-read':
      return {
        kind: 'clinic-gallery-read',
        path: config.path ?? 'clinic',
        status: config.value ?? 'published',
        statusField: config.statusPath ?? 'status',
      }
    case 'always-false':
      return { kind: 'always-false' }
    default:
      throw new Error(`Unsupported conditional scenario kind "${config.kind}" in permission matrix metadata.`)
  }
}

function ensureScenarioDefaults(scenario?: ConditionalScenario): ConditionalScenario | undefined {
  if (!scenario) return undefined
  if (scenario.kind === 'role-allow' && (!scenario.allow || scenario.allow.length === 0)) {
    return { ...scenario, allow: ['platform'] }
  }
  return scenario
}

function parseScenarioTokens(details?: string): Map<string, string> | null {
  if (!details) return null

  const matches = [...details.matchAll(/\[([^\[\]]+)\]/g)]
  if (matches.length === 0) return null

  const map = new Map<string, string>()
  for (const match of matches) {
    const raw = match[1]?.trim()
    if (!raw) continue
    const [key, value] = raw.split('=', 2).map((part) => part.trim())
    if (key) {
      map.set(key, value ?? 'true')
    }
  }

  return map
}

function scenarioFromTokens(
  collectionSlug: string,
  operation: Operation,
  tokens: Map<string, string> | null,
): ConditionalScenario | undefined {
  if (!tokens) return undefined

  const scenario = tokens.get('scenario')?.toLowerCase()
  if (!scenario) return undefined

  const field = tokens.get('field') ?? tokens.get('path')

  switch (scenario) {
    case 'always-false':
      return { kind: 'always-false' }
    case 'clinic-approved':
      return { kind: 'clinic-approved', path: field ?? 'status', value: tokens.get('value') ?? 'approved' }
    case 'clinic-scope':
      return { kind: 'clinic-scope', path: field ?? 'clinic' }
    case 'clinic-staff-update':
      return { kind: 'clinic-staff-update', path: field ?? 'user' }
    case 'patient-scope':
      return { kind: 'patient-scope', path: field ?? 'patient' }
    case 'patient-update-self':
      return { kind: 'patient-update-self' }
    case 'role-allow':
      return {
        kind: 'role-allow',
        allow: (tokens.get('allow') ?? tokens.get('roles') ?? 'platform')
          .split(',')
          .map((role) => role.trim())
          .filter(Boolean) as UserType[],
      }
    case 'clinic-media-create':
      return { kind: 'clinic-media-create' }
    case 'doctor-media-create':
      return { kind: 'doctor-media-create' }
    case 'user-profile-media-own':
      return { kind: 'user-profile-media-own' }
    case 'user-profile-media-create':
      return { kind: 'user-profile-media-create' }
    case 'doctor-clinic-scope':
      return { kind: 'clinic-scope', path: 'doctor.clinic' }
    case 'clinic-self':
      return { kind: 'clinic-scope', path: field ?? 'id' }
    case 'clinic-gallery-read':
      return {
        kind: 'clinic-gallery-read',
        path: field ?? 'clinic',
        status: tokens.get('status') ?? tokens.get('value') ?? 'published',
        statusField: tokens.get('statusPath') ?? tokens.get('statusField') ?? 'status',
      }
    default:
      return undefined
  }
}

function getConditionalScenario(ctx: ValidationContext): ConditionalScenario | undefined {
  const fromMeta = scenarioFromMeta(ctx.collectionSlug, ctx.operation)
  if (fromMeta) {
    return fromMeta
  }

  const fromTokens = scenarioFromTokens(ctx.collectionSlug, ctx.operation, parseScenarioTokens(ctx.expectation.details))
  if (fromTokens) {
    return ensureScenarioDefaults(fromTokens)
  }

  return undefined
}

/**
 * Determine if access result should be boolean true for this user/expectation combo
 */
export function expectsTrue(
  expectation: AccessExpectation,
  userType: 'platform' | 'clinic' | 'patient' | 'anonymous',
): boolean {
  switch (expectation.type) {
    case 'platform':
      return userType === 'platform'
    case 'anyone':
      return true
    case 'published':
      return userType === 'platform'
    case 'conditional':
      return userType === 'platform'
    default:
      return false
  }
}

/**
 * Determine if access result should be boolean false for this user/expectation combo
 */
export function expectsFalse(
  expectation: AccessExpectation,
  userType: 'platform' | 'clinic' | 'patient' | 'anonymous',
): boolean {
  switch (expectation.type) {
    case 'platform':
      return userType !== 'platform'
    case 'anyone':
      return false
    case 'published':
      return false
    case 'conditional':
      return false
    default:
      return userType !== 'platform'
  }
}

/**
 * Check if the access result should be a scope filter object
 */
export function expectsScopeFilter(
  expectation: AccessExpectation,
  userType: 'platform' | 'clinic' | 'patient' | 'anonymous',
): boolean {
  switch (expectation.type) {
    case 'platform':
      return false
    case 'anyone':
      return false
    case 'published':
      return userType !== 'platform'
    case 'conditional':
      return userType !== 'platform'
    default:
      return false
  }
}

/**
 * Validate that the access result matches expectations
 */
export function validateAccessResult(ctx: ValidationContext): Promise<void> {
  return validateAsync(ctx)
}

async function validateAsync(ctx: ValidationContext): Promise<void> {
  const value = await resolveResult(ctx.result)
  const expectation = ctx.expectation

  switch (expectation.type) {
    case 'platform':
      if (ctx.userType === 'platform') {
        expect(value).toBe(true)
      } else {
        expect(value).toBe(false)
      }
      return
    case 'anyone':
      expect(value).toBe(true)
      return
    case 'published':
      validatePublished(ctx, value)
      return
    case 'conditional':
      validateConditional(ctx, value)
      return
    default:
      if (typeof value !== 'boolean' && (typeof value !== 'object' || value === null)) {
        throw new Error(
          `Invalid access result for ${ctx.userType} ${ctx.operation} on ${ctx.collectionSlug}: ${JSON.stringify(value)}`,
        )
      }
  }
}

function validatePublished(ctx: ValidationContext, value: unknown) {
  if (ctx.userType === 'platform') {
    expect(value).toBe(true)
    return
  }

  const publishedMeta = getPublishedMeta(ctx.collectionSlug)

  if (publishedMeta?.filters) {
    const expected = publishedMeta.filters[ctx.userType]

    if (expected === undefined) {
      expect(value).toBe(false)
      return
    }

    if (typeof expected === 'boolean') {
      expect(value).toBe(expected)
      return
    }

    expect(value).toEqual(expected)
    return
  }

  const field = publishedMeta?.field ?? '_status'
  const expectedValue = publishedMeta?.value ?? 'published'
  expectFilter(value, field, expectedValue, ctx)
}

function validateConditional(ctx: ValidationContext, value: unknown) {
  const scenario = getConditionalScenario(ctx)
  if (!scenario) {
    if (ctx.userType === 'platform') {
      expect(value).toBe(true)
    } else {
      expect(value).toBe(false)
    }
    return
  }

  switch (scenario.kind) {
    case 'always-false':
      expect(value).toBe(false)
      return
    case 'clinic-approved':
      if (ctx.userType === 'platform') {
        expect(value).toBe(true)
      } else {
        expectFilter(value, scenario.path, scenario.value, ctx)
      }
      return
    case 'clinic-scope':
      validateClinicScoped(ctx, value, scenario.path)
      return
    case 'clinic-staff-update':
      if (ctx.userType === 'platform') {
        expect(value).toBe(true)
      } else if (ctx.userType === 'clinic') {
        expectFilter(value, scenario.path, ctx.user?.id, ctx)
      } else {
        expect(value).toBe(false)
      }
      return
    case 'patient-scope':
      if (ctx.userType === 'platform') {
        expect(value).toBe(true)
      } else if (ctx.userType === 'patient') {
        expectFilter(value, scenario.path, ctx.user?.id, ctx)
      } else {
        expect(value).toBe(false)
      }
      return
    case 'patient-update-self':
      if (ctx.userType === 'platform') {
        expect(value).toBe(true)
      } else if (ctx.userType === 'patient') {
        const targetId = ctx.args?.id
        expect(typeof value).toBe('boolean')
        expect(value).toBe(String(ctx.user?.id) === String(targetId))
      } else {
        expect(value).toBe(false)
      }
      return
    case 'role-allow':
      if (scenario.allow.includes(ctx.userType)) {
        expect(value).toBe(true)
      } else {
        expect(value).toBe(false)
      }
      return
    case 'clinic-media-create':
      if (ctx.userType === 'platform') {
        expect(value).toBe(true)
        return
      }

      if (ctx.userType === 'clinic') {
        const clinicId = getClinicIdFromUser(ctx.user)
        const dataClinic = extractRelationId(ctx.args?.data?.clinic)
        expect(value).toBe(Boolean(clinicId && dataClinic && String(clinicId) === String(dataClinic)))
        return
      }

      expect(value).toBe(false)
      return
    case 'doctor-media-create':
      if (ctx.userType === 'platform') {
        expect(value).toBe(true)
      } else if (ctx.userType === 'clinic') {
        expect(typeof value).toBe('boolean')
      } else {
        expect(value).toBe(false)
      }
      return
    case 'user-profile-media-own':
      validateUserProfileMediaAccess(ctx, value)
      return
    case 'user-profile-media-create':
      if (ctx.userType === 'platform') {
        expect(value).toBe(true)
        return
      }

      if (ctx.userType === 'clinic' || ctx.userType === 'patient') {
        const owner = ctx.args?.data?.user
        const ownerId = extractRelationId(owner)
        const ownerCollection =
          typeof owner === 'object' && owner !== null
            ? ('relationTo' in owner && owner.relationTo) ||
              ('collection' in owner && owner.collection) ||
              ('value' in owner &&
                typeof owner.value === 'object' &&
                owner.value !== null &&
                'relationTo' in owner.value &&
                owner.value.relationTo)
            : undefined
        const expectedCollection = ctx.userType === 'clinic' ? 'basicUsers' : 'patients'
        expect(value).toBe(
          Boolean(ownerId) && String(ownerId) === String(ctx.user?.id) && ownerCollection === expectedCollection,
        )
        return
      }

      expect(value).toBe(false)
      return
    case 'clinic-gallery-read':
      if (ctx.userType === 'platform') {
        expect(value).toBe(true)
      } else if (ctx.userType === 'clinic') {
        const clinicId = getClinicIdFromUser(ctx.user)
        if (clinicId) {
          expectFilter(value, scenario.path, clinicId, ctx)
        } else {
          expect(value).toBe(false)
        }
      } else {
        const expectedStatus = scenario.status ?? 'published'
        const statusField = scenario.statusField ?? 'status'
        expectFilter(value, statusField, expectedStatus, ctx)
      }
      return
  }

  if (ctx.userType === 'platform') {
    expect(value).toBe(true)
  } else {
    expect(value).toBe(false)
  }
}

function validateClinicScoped(ctx: ValidationContext, value: unknown, field: string) {
  if (ctx.userType === 'platform') {
    expect(value).toBe(true)
    return
  }

  if (ctx.userType === 'clinic') {
    const clinicId = getClinicIdFromUser(ctx.user)
    expectFilter(value, field, clinicId, ctx)
    return
  }

  expect(value).toBe(false)
}

function validateUserProfileMediaAccess(ctx: ValidationContext, value: unknown) {
  if (ctx.userType === 'platform') {
    expect(value).toBe(true)
    return
  }

  if (ctx.userType === 'clinic' || ctx.userType === 'patient') {
    const key = ctx.userType === 'clinic' ? 'user.basicUsers.id' : 'user.patients.id'
    expectFilter(value, key, ctx.user?.id, ctx)
    return
  }

  expect(value).toBe(false)
}

function expectFilter(value: unknown, path: string, expected: unknown, ctx: ValidationContext) {
  if (typeof value !== 'object' || value === null) {
    throw new Error(
      `Expected filter object for ${ctx.userType} ${ctx.operation} on ${ctx.collectionSlug}, got: ${JSON.stringify(value)}`,
    )
  }

  const polymorphicMatch = path.match(/^user\.(basicUsers|patients)\.id$/)
  if (polymorphicMatch) {
    const relationTo = polymorphicMatch[1]
    if (relationTo && matchesPolymorphicRelationshipAndFilter(value, 'user', relationTo, expected)) {
      return
    }
  }

  let actual: unknown
  if (Object.prototype.hasOwnProperty.call(value, path)) {
    actual = (value as Record<string, unknown>)[path]
  } else {
    actual = getByPath(value, path)
  }

  if (!actual || typeof actual !== 'object') {
    throw new Error(
      `Expected filter with path ${path} for ${ctx.userType} ${ctx.operation} on ${ctx.collectionSlug}, got: ${JSON.stringify(value)}`,
    )
  }

  if (!isEqualsFilter(actual)) {
    throw new Error(
      `Expected filter with path ${path} for ${ctx.userType} ${ctx.operation} on ${ctx.collectionSlug}, got: ${JSON.stringify(value)}`,
    )
  }

  expect(actual.equals).toBeDefined()
  expect(String(actual.equals)).toBe(String(expected))
}

function matchesPolymorphicRelationshipAndFilter(
  value: unknown,
  fieldName: string,
  relationTo: string,
  expectedId: unknown,
): boolean {
  if (typeof value !== 'object' || value === null) return false

  const maybeAnd = (value as Record<string, unknown>).and
  if (!Array.isArray(maybeAnd)) return false

  const relKey = `${fieldName}.relationTo`
  const valueKey = `${fieldName}.value`

  const hasRelationTo = maybeAnd.some((clause) => {
    if (typeof clause !== 'object' || clause === null) return false
    const candidate = (clause as Record<string, unknown>)[relKey]
    return isEqualsFilter(candidate) && String(candidate.equals) === String(relationTo)
  })

  const hasValue = maybeAnd.some((clause) => {
    if (typeof clause !== 'object' || clause === null) return false
    const candidate = (clause as Record<string, unknown>)[valueKey]
    return isEqualsFilter(candidate) && String(candidate.equals) === String(expectedId)
  })

  return hasRelationTo && hasValue
}

function getByPath(obj: unknown, path: string): unknown {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj) || obj instanceof Date || obj instanceof RegExp)
    return undefined
  return path.split('.').reduce<unknown>((acc, key) => {
    if (typeof acc !== 'object' || acc === null || Array.isArray(acc) || acc instanceof Date || acc instanceof RegExp)
      return undefined
    return (acc as Record<string, unknown>)[key]
  }, obj)
}

async function resolveResult(result: unknown): Promise<unknown> {
  if (isPromiseLike(result)) {
    return await result
  }
  return result
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return Boolean(value) && typeof (value as PromiseLike<unknown>).then === 'function'
}

function getClinicIdFromUser(user: TestUser): string | number | undefined {
  if (!user) return undefined
  const clinic = (user as Record<string, unknown>).clinic ?? (user as Record<string, unknown>).clinicId
  if (clinic && typeof clinic === 'object') {
    const clinicObject = clinic as Record<string, unknown>
    return (clinicObject.id as string | number | undefined) ?? (clinicObject.value as string | number | undefined)
  }
  if (clinic) return clinic as string | number | undefined
  return (user as Record<string, unknown>).id as string | number | undefined
}

function extractRelationId(value: unknown): string | number | undefined {
  if (value == null) return undefined
  if (typeof value === 'string' || typeof value === 'number') return value
  if (Array.isArray(value)) return extractRelationId(value[0])
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (record.value != null) return extractRelationId(record.value)
    if (record.id != null) return record.id as string | number | undefined
    if (record.doc != null) return extractRelationId(record.doc)
  }
  return undefined
}

function isEqualsFilter(value: unknown): value is { equals: unknown } {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date) &&
    !(value instanceof RegExp) &&
    'equals' in value
  )
}
