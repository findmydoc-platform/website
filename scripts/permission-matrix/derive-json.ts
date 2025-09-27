#!/usr/bin/env ts-node

import { readFileSync, writeFileSync } from 'fs'
import { resolve, join } from 'path'

const ROOT_DIR = resolve(__dirname, '../..')
const MATRIX_MD_FILE = join(ROOT_DIR, 'docs/security/permission-matrix.md')
const MATRIX_JSON_FILE = join(ROOT_DIR, 'docs/security/permission-matrix.json')

interface AccessExpectation {
  type: 'platform' | 'anyone' | 'published' | 'conditional'
  details?: string
}

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

interface PermissionMatrix {
  version: string
  source: string
  collections: Record<string, MatrixRow>
}

function parsePermission(permission: string): AccessExpectation {
  const cleaned = permission.trim()
  
  if (cleaned === '–' || cleaned === '-') {
    return { type: 'conditional', details: 'no access' }
  }
  
  if (cleaned === 'RWDA') {
    return { type: 'platform' }
  }
  
  if (cleaned.includes('*(published)*')) {
    return { type: 'published' }
  }
  
  if (cleaned === 'R') {
    return { type: 'anyone' }
  }
  
  if (cleaned.includes('C *(create only)*')) {
    return { type: 'anyone' }  // Anonymous can create
  }
  
  // Any other complex permission is conditional
  return { type: 'conditional', details: cleaned }
}

function extractSlugFromDisplayName(displayName: string): string {
  // Convert display names to slugs following Payload conventions
  const slugMap: Record<string, string> = {
    'BasicUsers': 'basicUsers',
    'PlatformStaff': 'platformStaff', 
    'ClinicStaff': 'clinicStaff',
    'Patients': 'patients',
    'Posts': 'posts',
    'Pages': 'pages',
    'Doctors': 'doctors',
    'Clinics': 'clinics',
    'DoctorSpecialties': 'doctorSpecialties',
    'DoctorTreatments': 'doctorTreatments',
    'ClinicTreatments': 'clinicTreatments',
    'FavoriteClinics': 'favoriteClinics',
    'Reviews': 'reviews',
    'Treatments': 'treatments',
    'MedicalSpecialties': 'medical-specialties',
    'Countries': 'countries',
    'Cities': 'cities',
    'PlatformContentMedia': 'platformContentMedia',
    'ClinicMedia': 'clinicMedia',
    'DoctorMedia': 'doctorMedia',
    'UserProfileMedia': 'userProfileMedia',
    'Tags': 'tags',
    'Categories': 'categories',
    'Accreditation': 'accreditation',
    'ClinicApplications': 'clinicApplications'
  }
  
  return slugMap[displayName] || displayName.toLowerCase()
}

async function parseMatrixMarkdown(): Promise<PermissionMatrix> {
  const content = readFileSync(MATRIX_MD_FILE, 'utf8')
  const lines = content.split('\n')
  
  const collections: Record<string, MatrixRow> = {}
  let inMatrix = false
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    // Find the start of the matrix table
    if (line.includes('| **Data Collection**') && line.includes('**Platform Staff**')) {
      inMatrix = true
      continue
    }
    
    if (inMatrix) {
      // Skip header separator and section headers
      if (line.includes('---') || line.includes('**') || line.trim() === '') {
        continue
      }
      
      // Stop at notes section
      if (line.includes('### Notes on Specific Rows')) {
        break
      }
      
      // Parse data rows
      const parts = line.split('|').map(p => p.trim()).filter(p => p !== '')
      
      if (parts.length >= 5) {
        const [displayName, platformAccess, clinicAccess, patientAccess, anonymousAccess] = parts
        
        // Skip if this looks like a section divider
        if (displayName.includes('*') || displayName === '') continue
        
        const slug = extractSlugFromDisplayName(displayName)
        
        // For simplicity, we'll primarily focus on the access patterns we can determine
        // Platform staff permissions determine create/update/delete/admin
        // Read permissions are determined by the most permissive role
        
        let readAccess: AccessExpectation
        if (anonymousAccess.includes('R') || patientAccess.includes('R')) {
          if (anonymousAccess.includes('published') || patientAccess.includes('published')) {
            readAccess = { type: 'published' }
          } else {
            readAccess = { type: 'anyone' }
          }
        } else if (clinicAccess.includes('R')) {
          readAccess = { type: 'conditional', details: 'clinic staff and platform' }
        } else {
          readAccess = { type: 'platform' }
        }
        
        let createAccess: AccessExpectation = { type: 'platform' }
        if (anonymousAccess.includes('C')) {
          createAccess = { type: 'anyone' }
        } else if (clinicAccess.includes('W') || clinicAccess.includes('RW')) {
          createAccess = { type: 'conditional', details: 'platform and clinic scoped' }
        }
        
        collections[slug] = {
          slug,
          displayName,
          operations: {
            create: createAccess,
            read: readAccess,
            update: platformAccess.includes('W') ? 
              (clinicAccess.includes('W') ? 
                { type: 'conditional', details: 'platform and clinic scoped' } : 
                { type: 'platform' }) : 
              { type: 'platform' },
            delete: { type: 'platform' }, // Generally platform only
            admin: { type: 'platform' }
          },
          notes: `Parsed from: Platform(${platformAccess}) Clinic(${clinicAccess}) Patient(${patientAccess}) Anonymous(${anonymousAccess})`
        }
      }
    }
  }
  
  return {
    version: '1.0.0',
    source: 'docs/security/permission-matrix.md', 
    collections
  }
}

async function main() {
  console.log('📝 Deriving JSON from permission matrix markdown...\n')
  
  try {
    const matrix = await parseMatrixMarkdown()
    
    console.log(`✅ Parsed ${Object.keys(matrix.collections).length} collections from markdown`)
    
    // Write the JSON file
    writeFileSync(MATRIX_JSON_FILE, JSON.stringify(matrix, null, 2))
    
    console.log(`✅ Written to ${MATRIX_JSON_FILE}`)
    console.log('\n📋 Collections found:')
    
    for (const [slug, row] of Object.entries(matrix.collections)) {
      console.log(`   - ${slug} (${row.displayName})`)
    }
    
    console.log('\n✅ Derivation completed successfully!')
    
  } catch (error) {
    console.error('❌ Error during derivation:', error)
    process.exit(1)
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}