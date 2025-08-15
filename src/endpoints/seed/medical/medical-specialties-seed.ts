import { Payload } from 'payload'
import { upsertByUniqueField } from '../seed-helpers'

/**
 * Seed hierarchical medical specialties based on consolidated category tree from 
 * Bookimed, Flymedi and WhatClinic (parents then children) idempotently.
 * @param payload Payload instance
 * @returns created / updated aggregate counts
 */
export async function seedMedicalSpecialties(payload: Payload): Promise<{ created: number; updated: number }> {
  payload.logger.info('— Seeding medical specialties (idempotent)...')

  // Root categories (no parent)
  const rootCategories = [
    { name: 'Aesthetics & Cosmetic Medicine', description: 'Cosmetic procedures, aesthetic treatments, and beauty services.' },
    { name: 'Alternative & Holistic Medicine', description: 'Non-conventional medical approaches and holistic healing methods.' },
    { name: 'Dentistry & Oral Health', description: 'Dental care, oral health treatments, and dental surgery.' },
    { name: 'Dermatology & Skin', description: 'Skin conditions, dermatological treatments, and skin care.' },
    { name: 'Diagnostics & Imaging', description: 'Medical testing, diagnostic procedures, and medical imaging.' },
    { name: 'Eye, ENT & Ophthalmology', description: 'Eye care, ear-nose-throat treatments, and vision correction.' },
    { name: 'General Practice & Primary Care', description: 'Primary healthcare, general medicine, and family practice.' },
    { name: 'Medicine (Non-Surgical Specialties)', description: 'Internal medicine specialties and non-surgical treatments.' },
  ]

  let created = 0
  let updated = 0
  const categoryMap: Record<string, any> = {}

  // Create root categories first
  for (const category of rootCategories) {
    const res = await upsertByUniqueField(payload, 'medical-specialties', 'name', category)
    if (res.created) created++
    if (res.updated) updated++
    categoryMap[category.name] = res.doc
  }

  // Subcategories with their parent relationships
  const subcategories = [
    // Aesthetics & Cosmetic Medicine subcategories
    { name: 'Aesthetic Medicine & Cosmetology', description: 'Non-surgical aesthetic treatments and cosmetic procedures.', parent: 'Aesthetics & Cosmetic Medicine' },
    { name: 'Beauty Salons', description: 'Beauty treatments and cosmetic services.', parent: 'Aesthetics & Cosmetic Medicine' },
    { name: 'Cosmetic / Plastic Surgery', description: 'Surgical cosmetic and reconstructive procedures.', parent: 'Aesthetics & Cosmetic Medicine' },
    { name: 'Cosmetology', description: 'Cosmetic treatment and beauty enhancement services.', parent: 'Aesthetics & Cosmetic Medicine' },
    { name: 'Hair Loss Clinics / Hair Transplant', description: 'Hair restoration and hair transplant treatments.', parent: 'Aesthetics & Cosmetic Medicine' },
    { name: 'Medical Aesthetics / Beauty Clinics', description: 'Medical-grade aesthetic and beauty treatments.', parent: 'Aesthetics & Cosmetic Medicine' },
    
    // Alternative & Holistic Medicine subcategories
    { name: 'Holistic Health', description: 'Comprehensive health approaches treating the whole person.', parent: 'Alternative & Holistic Medicine' },
    { name: 'Traditional Chinese Medicine', description: 'Ancient Chinese medical practices and treatments.', parent: 'Alternative & Holistic Medicine' },
    
    // Dentistry & Oral Health subcategories
    { name: 'Cosmetic Dentists', description: 'Aesthetic dental treatments and smile enhancement.', parent: 'Dentistry & Oral Health' },
    { name: 'Dental Treatment / Dentistry', description: 'General dental care and oral health treatments.', parent: 'Dentistry & Oral Health' },
    { name: 'Dentists', description: 'General dental practitioners and oral healthcare providers.', parent: 'Dentistry & Oral Health' },
    { name: 'Maxillofacial Surgery', description: 'Surgical treatment of face, jaw, and oral cavity conditions.', parent: 'Dentistry & Oral Health' },
    { name: 'Orthodontists', description: 'Teeth alignment and bite correction specialists.', parent: 'Dentistry & Oral Health' },
    
    // Dermatology & Skin subcategories
    { name: 'Dermatology', description: 'Medical treatment of skin, hair, and nail conditions.', parent: 'Dermatology & Skin' },
    
    // Diagnostics & Imaging subcategories
    { name: 'Diagnostic Imaging', description: 'Medical imaging for diagnosis and treatment planning.', parent: 'Diagnostics & Imaging' },
    { name: 'Diagnostics', description: 'Medical testing and diagnostic procedures.', parent: 'Diagnostics & Imaging' },
    { name: 'Medical Check-up', description: 'Preventive health screenings and comprehensive examinations.', parent: 'Diagnostics & Imaging' },
    { name: 'Nuclear Medicine', description: 'Radioactive substances for diagnosis and treatment.', parent: 'Diagnostics & Imaging' },
    
    // Eye, ENT & Ophthalmology subcategories
    { name: 'Ear, Nose and Throat (ENT)', description: 'Treatment of ear, nose, throat, and head/neck conditions.', parent: 'Eye, ENT & Ophthalmology' },
    { name: 'Eye Care / Eye Clinics', description: 'Comprehensive eye care and vision services.', parent: 'Eye, ENT & Ophthalmology' },
    { name: 'LASIK Laser Eye Surgery', description: 'Laser vision correction and refractive surgery.', parent: 'Eye, ENT & Ophthalmology' },
    { name: 'Otorhinolaryngology', description: 'Medical and surgical treatment of ear, nose, and throat disorders.', parent: 'Eye, ENT & Ophthalmology' },
    { name: 'Ophthalmology', description: 'Medical and surgical eye care and vision treatment.', parent: 'Eye, ENT & Ophthalmology' },
    
    // General Practice & Primary Care subcategories
    { name: 'Doctors / General Practice', description: 'Primary care physicians and general medical practitioners.', parent: 'General Practice & Primary Care' },
    
    // Medicine (Non-Surgical Specialties) subcategories
    { name: 'Cardiology', description: 'Heart and cardiovascular system disorders.', parent: 'Medicine (Non-Surgical Specialties)' },
  ]

  // Create subcategories
  for (const subcategory of subcategories) {
    const parent = categoryMap[subcategory.parent]
    const res = await upsertByUniqueField(payload, 'medical-specialties', 'name', {
      name: subcategory.name,
      description: subcategory.description,
      parentSpecialty: parent?.id,
    })
    if (res.created) created++
    if (res.updated) updated++
  }

  payload.logger.info('— Finished seeding medical specialties.')
  return { created, updated }
}
