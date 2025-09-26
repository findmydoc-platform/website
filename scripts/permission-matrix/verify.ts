#!/usr/bin/env ts-node

import { readFileSync, existsSync } from 'fs'
import { resolve, join } from 'path'
import { glob } from 'glob'

interface MatrixRow {
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

interface AccessExpectation {
  type: 'platform' | 'anyone' | 'published' | 'conditional'
  details?: string
}

interface PermissionMatrix {
  version: string
  source: string
  collections: Record<string, MatrixRow>
}

interface CollectionConfig {
  slug: string
  [key: string]: any
}

const ROOT_DIR = resolve(__dirname, '../..')
const MATRIX_FILE = join(ROOT_DIR, 'docs/security/permission-matrix.json')
const COLLECTIONS_DIR = join(ROOT_DIR, 'src/collections')
const TEST_DIR = join(ROOT_DIR, 'tests/unit/access-matrix')
const CONFIG_FILE = join(ROOT_DIR, 'src/payload.config.ts')

async function loadMatrix(): Promise<PermissionMatrix> {
  if (!existsSync(MATRIX_FILE)) {
    throw new Error(`Permission matrix file not found: ${MATRIX_FILE}`)
  }
  return JSON.parse(readFileSync(MATRIX_FILE, 'utf8'))
}

async function getCollectionSlugs(): Promise<string[]> {
  // Read the payload config to get the actual collection list
  const configContent = readFileSync(CONFIG_FILE, 'utf8')
  
  // Extract collection imports and usage
  const collections: string[] = []
  const lines = configContent.split('\n')
  
  let inCollectionsArray = false
  for (const line of lines) {
    if (line.trim() === 'collections: [') {
      inCollectionsArray = true
      continue
    }
    if (inCollectionsArray) {
      if (line.trim() === '],') {
        break
      }
      const match = line.trim().match(/^(\w+),?$/)
      if (match) {
        collections.push(match[1])
      }
    }
  }
  
  return collections
}

async function getCollectionSlugFromFile(filePath: string): Promise<string | null> {
  try {
    const content = readFileSync(filePath, 'utf8')
    const slugMatch = content.match(/slug:\s*['"`]([^'"`]+)['"`]/)
    return slugMatch ? slugMatch[1] : null
  } catch {
    return null
  }
}

async function main() {
  console.log('🔍 Verifying permission matrix alignment...\n')
  
  let hasErrors = false
  
  try {
    // Load the permission matrix
    const matrix = await loadMatrix()
    console.log(`✅ Loaded permission matrix (v${matrix.version})`)
    
    // Get collection names from payload config
    const configCollections = await getCollectionSlugs()
    console.log(`✅ Found ${configCollections.length} collections in payload.config.ts`)
    
    // Get collection files
    const collectionFiles = await glob('**/*.{ts,js}', { 
      cwd: COLLECTIONS_DIR, 
      ignore: ['**/index.ts', '**/*.test.ts', '**/hooks/**']
    })
    
    const collectionSlugs = new Set<string>()
    const collectionFileMap = new Map<string, string>()
    
    for (const file of collectionFiles) {
      const fullPath = join(COLLECTIONS_DIR, file)
      const slug = await getCollectionSlugFromFile(fullPath)
      if (slug) {
        collectionSlugs.add(slug)
        collectionFileMap.set(slug, file)
      }
    }
    
    // Also check subdirectories with index.ts
    const indexFiles = await glob('**/index.ts', { cwd: COLLECTIONS_DIR })
    for (const file of indexFiles) {
      const fullPath = join(COLLECTIONS_DIR, file)
      const slug = await getCollectionSlugFromFile(fullPath)
      if (slug) {
        collectionSlugs.add(slug)
        collectionFileMap.set(slug, file)
      }
    }
    
    console.log(`✅ Found ${collectionSlugs.size} collection definitions in src/collections/`)
    
    // Verify matrix completeness
    console.log('\n📋 Matrix Coverage Analysis:')
    
    const matrixSlugs = new Set(Object.keys(matrix.collections))
    const missingSlugsInMatrix = new Set<string>()
    const extraSlugsInMatrix = new Set<string>()
    
    for (const slug of collectionSlugs) {
      if (!matrixSlugs.has(slug)) {
        missingSlugsInMatrix.add(slug)
      }
    }
    
    for (const slug of matrixSlugs) {
      if (!collectionSlugs.has(slug)) {
        extraSlugsInMatrix.add(slug)
      }
    }
    
    if (missingSlugsInMatrix.size > 0) {
      console.log(`❌ Collections missing from matrix:`)
      for (const slug of missingSlugsInMatrix) {
        console.log(`   - ${slug} (file: ${collectionFileMap.get(slug) || 'unknown'})`)
        hasErrors = true
      }
    }
    
    if (extraSlugsInMatrix.size > 0) {
      console.log(`⚠️  Matrix entries with no corresponding collection:`)
      for (const slug of extraSlugsInMatrix) {
        console.log(`   - ${slug}`)
      }
    }
    
    if (missingSlugsInMatrix.size === 0 && extraSlugsInMatrix.size === 0) {
      console.log(`✅ Perfect alignment: ${matrixSlugs.size} collections covered`)
    }
    
    // Check test coverage
    console.log('\n🧪 Test Coverage Analysis:')
    
    if (!existsSync(TEST_DIR)) {
      console.log(`❌ Test directory does not exist: ${TEST_DIR}`)
      hasErrors = true
    } else {
      const testFiles = await glob('*.permission.test.ts', { cwd: TEST_DIR })
      const testSlugs = new Set(
        testFiles.map(file => file.replace('.permission.test.ts', ''))
      )
      
      console.log(`✅ Found ${testFiles.length} permission test files`)
      
      const missingTests = new Set<string>()
      const extraTests = new Set<string>()
      
      for (const slug of collectionSlugs) {
        if (!testSlugs.has(slug)) {
          missingTests.add(slug)
        }
      }
      
      for (const slug of testSlugs) {
        if (!collectionSlugs.has(slug)) {
          extraTests.add(slug)
        }
      }
      
      if (missingTests.size > 0) {
        console.log(`❌ Collections missing permission tests:`)
        for (const slug of missingTests) {
          console.log(`   - ${slug} (should have: ${slug}.permission.test.ts)`)
          hasErrors = true
        }
      }
      
      if (extraTests.size > 0) {
        console.log(`⚠️  Test files with no corresponding collection:`)
        for (const slug of extraTests) {
          console.log(`   - ${slug}.permission.test.ts`)
        }
      }
      
      if (missingTests.size === 0 && extraTests.size === 0) {
        console.log(`✅ Perfect test coverage: ${testSlugs.size} collections tested`)
      }
    }
    
  } catch (error) {
    console.error(`❌ Error during verification:`, error)
    hasErrors = true
  }
  
  console.log('\n' + '='.repeat(50))
  
  if (hasErrors) {
    console.log('❌ Verification FAILED - alignment issues found')
    process.exit(1)
  } else {
    console.log('✅ Verification PASSED - matrix and tests are aligned')
    process.exit(0)
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}