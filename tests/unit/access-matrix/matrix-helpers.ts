import { readFileSync } from 'fs'
import { join } from 'path'

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
}

export interface PermissionMatrix {
  version: string
  source: string
  collections: Record<string, MatrixRow>
}

let _matrix: PermissionMatrix | null = null

/**
 * Load the permission matrix from JSON file
 */
export function getMatrix(): PermissionMatrix {
  if (!_matrix) {
    const matrixPath = join(__dirname, '../../../docs/security/permission-matrix.json')
    _matrix = JSON.parse(readFileSync(matrixPath, 'utf8'))
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

/**
 * Determine if access result should be boolean true for this user/expectation combo
 */
export function expectsTrue(expectation: AccessExpectation, userType: 'platform' | 'clinic' | 'patient' | 'anonymous'): boolean {
  switch (expectation.type) {
    case 'platform':
      return userType === 'platform'
    case 'anyone':
      return true
    case 'published':
      return userType === 'platform'  // Only platform gets true, others get scope filter
    case 'conditional':
      // Most conditionals only give platform users true access
      return userType === 'platform'
    default:
      return false
  }
}

/**
 * Determine if access result should be boolean false for this user/expectation combo
 */
export function expectsFalse(expectation: AccessExpectation, userType: 'platform' | 'clinic' | 'patient' | 'anonymous'): boolean {
  switch (expectation.type) {
    case 'platform':
      return userType !== 'platform'
    case 'anyone':
      return false  // Anyone means no one gets false
    case 'published':
      return false  // Non-platform users get scope filters, not false
    case 'conditional':
      // This depends on the specific condition - safer to check for object
      return false
    default:
      return userType !== 'platform'  // Default to platform-only
  }
}

/**
 * Check if the access result should be a scope filter object
 */
export function expectsScopeFilter(expectation: AccessExpectation, userType: 'platform' | 'clinic' | 'patient' | 'anonymous'): boolean {
  switch (expectation.type) {
    case 'platform':
      return false  // Platform access is always boolean
    case 'anyone':
      return false  // Anyone access is always boolean true
    case 'published':
      return userType !== 'platform'  // Non-platform users get published filter
    case 'conditional':
      return userType !== 'platform'  // Non-platform users often get scope filters
    default:
      return false
  }
}

/**
 * Validate that the access result matches expectations
 */
export function validateAccessResult(
  result: any, 
  expectation: AccessExpectation, 
  userType: 'platform' | 'clinic' | 'patient' | 'anonymous',
  operation: string,
  collectionSlug: string
): void {
  // Handle promises - some access functions are async
  if (result && typeof result.then === 'function') {
    throw new Error(`${collectionSlug}.${operation} returned a Promise - access functions should not be async in tests`)
  }

  if (expectsTrue(expectation, userType)) {
    if (result !== true) {
      throw new Error(`Expected true for ${userType} ${operation} on ${collectionSlug}, got: ${JSON.stringify(result)}`)
    }
  } else if (expectsFalse(expectation, userType)) {
    if (result !== false) {
      throw new Error(`Expected false for ${userType} ${operation} on ${collectionSlug}, got: ${JSON.stringify(result)}`)
    }
  } else if (expectsScopeFilter(expectation, userType)) {
    if (typeof result !== 'object' || result === null) {
      throw new Error(`Expected scope filter object for ${userType} ${operation} on ${collectionSlug}, got: ${JSON.stringify(result)}`)
    }
    // Scope filter should be a non-null object
  } else {
    // For complex cases, just verify it's a valid access result (boolean or object)
    if (typeof result !== 'boolean' && (typeof result !== 'object' || result === null)) {
      throw new Error(`Invalid access result for ${userType} ${operation} on ${collectionSlug}: ${JSON.stringify(result)}`)
    }
  }
}

/**
 * Get expected scope filter for conditional access
 */
export function getExpectedScopeFilter(expectation: AccessExpectation, userType: 'platform' | 'clinic' | 'patient' | 'anonymous', user: any): any {
  if (!shouldReturnScopeFilter(expectation)) {
    return null
  }

  // Common patterns
  if (expectation.details?.includes('own clinic') && userType === 'clinic') {
    return { clinic: { equals: user.clinic || user.clinicId } }
  }
  
  if (expectation.details?.includes('own list') && userType === 'patient') {
    return { patient: { equals: user.id } }
  }
  
  if (expectation.details?.includes('own profile')) {
    if (userType === 'patient') {
      return { id: { equals: user.id } }
    }
    if (userType === 'clinic') {
      return { id: { equals: user.id } }
    }
  }
  
  return null
}