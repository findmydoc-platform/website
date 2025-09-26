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
 * Check if access expectation should result in boolean true/false
 */
export function shouldReturnBoolean(expectation: AccessExpectation): boolean {
  return expectation.type === 'platform' || expectation.type === 'anyone'
}

/**
 * Check if access expectation should result in a scope filter object
 */
export function shouldReturnScopeFilter(expectation: AccessExpectation): boolean {
  return expectation.type === 'conditional' && 
         (expectation.details?.includes('scoped') || 
          expectation.details?.includes('own') ||
          expectation.details?.includes('clinic'))
}

/**
 * Determine expected boolean result for user/expectation combo
 */
export function getExpectedBoolean(expectation: AccessExpectation, userType: 'platform' | 'clinic' | 'patient' | 'anonymous'): boolean {
  switch (expectation.type) {
    case 'platform':
      return userType === 'platform'
    case 'anyone':
      return true
    case 'published':
      return true  // Published content is readable by all
    case 'conditional':
      // Complex conditional logic - for now return platform only for safety
      return userType === 'platform'
    default:
      return false
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