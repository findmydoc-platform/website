#!/usr/bin/env node

const { readFileSync, existsSync, readdirSync } = require('fs')
const { resolve, join } = require('path')

const ROOT_DIR = resolve(__dirname, '../..')
const MATRIX_FILE = join(ROOT_DIR, 'docs/security/permission-matrix.json')
const COLLECTIONS_DIR = join(ROOT_DIR, 'src/collections')
const TEST_DIR = join(ROOT_DIR, 'tests/unit/access-matrix')
const CONFIG_FILE = join(ROOT_DIR, 'src/payload.config.ts')

function walkDir(dir, pattern = /\.(ts|js)$/) {
  let results = []
  
  try {
    const files = readdirSync(dir, { withFileTypes: true })
    
    for (const file of files) {
      const fullPath = join(dir, file.name)
      
      if (file.isDirectory()) {
        // Skip hooks directories and node_modules
        if (file.name !== 'hooks' && file.name !== 'node_modules') {
          results = results.concat(walkDir(fullPath, pattern))
        }
      } else if (pattern.test(file.name) && !file.name.includes('.test.')) {
        results.push(fullPath)
      }
    }
  } catch (error) {
    // Directory may not exist or be accessible
  }
  
  return results
}

async function loadMatrix() {
  if (!existsSync(MATRIX_FILE)) {
    throw new Error(`Permission matrix file not found: ${MATRIX_FILE}`)
  }
  return JSON.parse(readFileSync(MATRIX_FILE, 'utf8'))
}

async function getCollectionSlugs() {
  // Read the payload config to get the actual collection list
  const configContent = readFileSync(CONFIG_FILE, 'utf8')
  
  // Extract collection imports and usage
  const collections = []
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

async function getCollectionSlugFromFile(filePath) {
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
    const collectionFiles = walkDir(COLLECTIONS_DIR)
    
    const collectionSlugs = new Set()
    const collectionFileMap = new Map()
    
    for (const file of collectionFiles) {
      const slug = await getCollectionSlugFromFile(file)
      if (slug) {
        const relativePath = file.replace(COLLECTIONS_DIR + '/', '')
        collectionSlugs.add(slug)
        collectionFileMap.set(slug, relativePath)
      }
    }
    
    console.log(`✅ Found ${collectionSlugs.size} collection definitions in src/collections/`)
    
    // Verify matrix completeness
    console.log('\n📋 Matrix Coverage Analysis:')
    
    const matrixSlugs = new Set(Object.keys(matrix.collections))
    const missingSlugsInMatrix = new Set()
    const extraSlugsInMatrix = new Set()
    
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
      const testFiles = readdirSync(TEST_DIR).filter(f => f.endsWith('.permission.test.ts'))
      const testSlugs = new Set(
        testFiles.map(file => file.replace('.permission.test.ts', ''))
      )
      
      console.log(`✅ Found ${testFiles.length} permission test files`)
      
      const missingTests = new Set()
      const extraTests = new Set()
      
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

main().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})