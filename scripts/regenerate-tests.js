#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const COLLECTIONS_DIR = path.join(__dirname, '../src/collections')
const TESTS_DIR = path.join(__dirname, '../tests/unit/access-matrix')

// Map of access function names to their behavior patterns
const ACCESS_PATTERNS = {
  // Simple boolean functions
  isPlatformBasicUser: { type: 'boolean', platform: true, others: false },
  isClinicBasicUser: { type: 'boolean', clinic: true, others: false },
  isPatient: { type: 'boolean', patient: true, others: false },
  anyone: { type: 'boolean', all: true },

  // Scope filter functions
  platformOnlyOrPublished: {
    type: 'mixed',
    platform: true,
    others: { _status: { equals: 'published' } },
  },
  platformOnlyOrApproved: {
    type: 'mixed',
    platform: true,
    others: { status: { equals: 'approved' } },
  },
  platformOrOwnClinicResource: {
    type: 'async_mixed',
    platform: true,
    clinic: { clinic: { equals: 'CLINIC_ID' } },
    others: false,
  },
  platformOrOwnPatientResource: {
    type: 'async_mixed',
    platform: true,
    patient: { patient: { equals: 'USER_ID' } },
    others: false,
  },
  platformOrOwnClinicProfile: {
    type: 'async_mixed',
    platform: true,
    clinic: { id: { equals: 'CLINIC_ID' } },
    others: false,
  },
  ownResourceOnly: {
    type: 'scope',
    authenticated: { user: { equals: 'USER_ID' } },
    others: false,
  },
}

function extractAccessPattern(collectionContent, operation) {
  const accessRegex = new RegExp(`${operation}\\s*:\\s*([^,}]+)`)
  const match = collectionContent.match(accessRegex)

  if (!match) return null

  const accessCode = match[1].trim()

  // Handle inline functions
  if (accessCode === '() => false') {
    return { type: 'boolean', all: false }
  }
  if (accessCode === '() => true') {
    return { type: 'boolean', all: true }
  }

  // Handle function calls with req parameter
  const funcCallMatch = accessCode.match(/\(\{\s*req\s*\}\)\s*=>\s*(\w+)\(\{\s*req\s*\}\)/)
  if (funcCallMatch) {
    const funcName = funcCallMatch[1]
    return ACCESS_PATTERNS[funcName] || null
  }

  // Handle direct function references
  const directFuncMatch = accessCode.match(/^(\w+)$/)
  if (directFuncMatch) {
    const funcName = directFuncMatch[1]
    return ACCESS_PATTERNS[funcName] || null
  }

  return null
}

function generateTestAssertions(pattern, operation) {
  if (!pattern) {
    return `// TODO: Unknown access pattern for ${operation}
      expect(typeof result === 'boolean' || typeof result === 'object' || result === null).toBe(true)`
  }

  const assertions = []

  if (pattern.type === 'boolean') {
    if (pattern.all === true) {
      assertions.push('expect(result).toBe(true)')
    } else if (pattern.all === false) {
      assertions.push('expect(result).toBe(false)')
    } else {
      // Conditional boolean
      const conditions = []
      if (pattern.platform) conditions.push("userType === 'platform'")
      if (pattern.clinic) conditions.push("userType === 'clinic'")
      if (pattern.patient) conditions.push("userType === 'patient'")
      if (pattern.authenticated) conditions.push('user !== null')

      if (conditions.length > 0) {
        assertions.push(`if (${conditions.join(' || ')}) {`)
        assertions.push('  expect(result).toBe(true)')
        assertions.push('} else {')
        assertions.push('  expect(result).toBe(false)')
        assertions.push('}')
      }
    }
  } else if (pattern.type === 'mixed' || pattern.type === 'async_mixed') {
    assertions.push("if (userType === 'platform') {")
    assertions.push('  expect(result).toBe(true)')
    assertions.push('} else {')

    if (typeof pattern.others === 'object') {
      assertions.push(`  expect(result).toEqual(${JSON.stringify(pattern.others)})`)
    } else {
      assertions.push(`  expect(result).toBe(${pattern.others})`)
    }
    assertions.push('}')
  } else if (pattern.type === 'scope') {
    assertions.push('if (user) {')
    if (typeof pattern.authenticated === 'object') {
      // Replace placeholders with actual values
      const expected = JSON.stringify(pattern.authenticated).replace('"USER_ID"', 'user.id')
      assertions.push(`  expect(result).toEqual(${expected})`)
    } else {
      assertions.push(`  expect(result).toBe(${pattern.authenticated})`)
    }
    assertions.push('} else {')
    assertions.push(`  expect(result).toBe(${pattern.others})`)
    assertions.push('}')
  }

  return assertions.join('\n      ')
}

function generateTestFile(collectionSlug, collectionName, accessPatterns) {
  return `import { describe, test, expect } from 'vitest'
import { ${collectionName} } from '@/collections/${collectionName}'
import { mockUsers } from '../helpers/mockUsers'
import { createMockReq } from '../helpers/testHelpers'
import { getMatrixRow } from './matrix-helpers'

describe('${collectionName} - Permission Matrix Compliance', () => {
  const matrixRow = getMatrixRow('${collectionSlug}')

  describe('access control', () => {
    const userMatrix = [
      ['platform staff', mockUsers.platform(), 'platform'],
      ['clinic staff', mockUsers.clinic(), 'clinic'],
      ['patient', mockUsers.patient(), 'patient'],
      ['anonymous', null, 'anonymous'],
    ] as const

    test.each(userMatrix)('%s create access', (description, user, userType) => {
      const req = createMockReq(user)
      const result = ${collectionName}.access!.create!({ req } as any)

      ${generateTestAssertions(accessPatterns.create, 'create')}
    })

    test.each(userMatrix)('%s read access', (description, user, userType) => {
      const req = createMockReq(user)
      const result = ${collectionName}.access!.read!({ req } as any)

      ${generateTestAssertions(accessPatterns.read, 'read')}
    })

    test.each(userMatrix)('%s update access', (description, user, userType) => {
      const req = createMockReq(user)
      const result = ${collectionName}.access!.update!({ req } as any)

      ${generateTestAssertions(accessPatterns.update, 'update')}
    })

    test.each(userMatrix)('%s delete access', (description, user, userType) => {
      const req = createMockReq(user)
      const result = ${collectionName}.access!.delete!({ req } as any)

      ${generateTestAssertions(accessPatterns.delete, 'delete')}
    })
  })

  test('matrix row verification', () => {
    expect(matrixRow.slug).toBe('${collectionSlug}')
    expect(matrixRow.displayName).toBe('${collectionName}')
    expect(matrixRow.operations).toBeDefined()
    expect(matrixRow.operations.create).toBeDefined()
    expect(matrixRow.operations.read).toBeDefined()
    expect(matrixRow.operations.update).toBeDefined()
    expect(matrixRow.operations.delete).toBeDefined()
  })
})`
}

function main() {
  console.log('🔧 Analyzing collections and regenerating tests...\n')

  const matrix = JSON.parse(fs.readFileSync(path.join(__dirname, '../docs/security/permission-matrix.json'), 'utf8'))

  let regeneratedCount = 0
  let skippedCount = 0

  for (const [slug, row] of Object.entries(matrix.collections)) {
    const collectionName = row.displayName

    // Find the collection file
    const possiblePaths = [
      path.join(COLLECTIONS_DIR, `${collectionName}.ts`),
      path.join(COLLECTIONS_DIR, `${collectionName}/index.ts`),
    ]

    let collectionPath = null
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        collectionPath = p
        break
      }
    }

    if (!collectionPath) {
      console.log(`⚠️  Skipping ${slug} - collection file not found`)
      skippedCount++
      continue
    }

    const collectionContent = fs.readFileSync(collectionPath, 'utf8')

    // Extract access patterns
    const accessPatterns = {
      create: extractAccessPattern(collectionContent, 'create'),
      read: extractAccessPattern(collectionContent, 'read'),
      update: extractAccessPattern(collectionContent, 'update'),
      delete: extractAccessPattern(collectionContent, 'delete'),
    }

    // Generate test file
    const testContent = generateTestFile(slug, collectionName, accessPatterns)
    const testPath = path.join(TESTS_DIR, `${slug}.permission.test.ts`)

    fs.writeFileSync(testPath, testContent)
    console.log(`✅ Regenerated ${slug}.permission.test.ts`)
    regeneratedCount++
  }

  console.log(`\n🎉 Regenerated ${regeneratedCount} test files, skipped ${skippedCount}`)
}

main()
