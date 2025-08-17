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
    {
      name: 'Aesthetics & Cosmetic Medicine',
      description: 'Cosmetic procedures, aesthetic treatments, and beauty services.',
    },
    {
      name: 'Alternative & Holistic Medicine',
      description: 'Non-conventional medical approaches and holistic healing methods.',
    },
    { name: 'Dentistry & Oral Health', description: 'Dental care, oral health treatments, and dental surgery.' },
    { name: 'Dermatology & Skin', description: 'Skin conditions, dermatological treatments, and skin care.' },
    { name: 'Diagnostics & Imaging', description: 'Medical testing, diagnostic procedures, and medical imaging.' },
    { name: 'Eye, ENT & Ophthalmology', description: 'Eye care, ear-nose-throat treatments, and vision correction.' },
    {
      name: 'General Practice & Primary Care',
      description: 'Primary healthcare, general medicine, and family practice.',
    },
    {
      name: 'Medicine (Non-Surgical Specialties)',
      description: 'Internal medicine specialties and non-surgical treatments.',
    },
    {
      name: 'Mental Health & Behavioural Sciences',
      description: 'Psychology, psychiatry, psychotherapy, and behavioral health services.',
    },
    { name: 'Pediatrics', description: 'Medical care and surgery for infants, children, and adolescents.' },
    {
      name: 'Rehabilitation & Physical Therapy',
      description: 'Recovery, physiotherapy, and assistive rehabilitation services.',
    },
    { name: 'Surgery', description: 'General and specialized surgical procedures.' },
    { name: 'Transplant Medicine', description: 'Organ and tissue transplantation and related care.' },
    {
      name: 'Weight Management & Metabolic',
      description: 'Metabolic disorders and weight-loss surgical care.',
    },
    {
      name: 'Wellness, Longevity & Spa',
      description: 'Preventive care, longevity, and wellness/spa services.',
    },
    {
      name: 'Women’s Health & Fertility',
      description: 'Gynecology, obstetrics, breast health, and fertility services.',
    },
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
    {
      name: 'Aesthetic Medicine & Cosmetology',
      description: 'Non-surgical aesthetic treatments and cosmetic procedures.',
      parent: 'Aesthetics & Cosmetic Medicine',
    },
    {
      name: 'Beauty Salons',
      description: 'Beauty treatments and cosmetic services.',
      parent: 'Aesthetics & Cosmetic Medicine',
    },
    {
      name: 'Cosmetic / Plastic Surgery',
      description: 'Surgical cosmetic and reconstructive procedures.',
      parent: 'Aesthetics & Cosmetic Medicine',
    },
    {
      name: 'Cosmetology',
      description: 'Cosmetic treatment and beauty enhancement services.',
      parent: 'Aesthetics & Cosmetic Medicine',
    },
    {
      name: 'Hair Loss Clinics / Hair Transplant',
      description: 'Hair restoration and hair transplant treatments.',
      parent: 'Aesthetics & Cosmetic Medicine',
    },
    {
      name: 'Medical Aesthetics / Beauty Clinics',
      description: 'Medical-grade aesthetic and beauty treatments.',
      parent: 'Aesthetics & Cosmetic Medicine',
    },

    // Alternative & Holistic Medicine subcategories
    {
      name: 'Holistic Health',
      description: 'Comprehensive health approaches treating the whole person.',
      parent: 'Alternative & Holistic Medicine',
    },
    {
      name: 'Traditional Chinese Medicine',
      description: 'Ancient Chinese medical practices and treatments.',
      parent: 'Alternative & Holistic Medicine',
    },

    // Dentistry & Oral Health subcategories
    {
      name: 'Cosmetic Dentists',
      description: 'Aesthetic dental treatments and smile enhancement.',
      parent: 'Dentistry & Oral Health',
    },
    {
      name: 'Dental Treatment / Dentistry',
      description: 'General dental care and oral health treatments.',
      parent: 'Dentistry & Oral Health',
    },
    {
      name: 'Dentists',
      description: 'General dental practitioners and oral healthcare providers.',
      parent: 'Dentistry & Oral Health',
    },
    {
      name: 'Maxillofacial Surgery',
      description: 'Surgical treatment of face, jaw, and oral cavity conditions.',
      parent: 'Dentistry & Oral Health',
    },
    {
      name: 'Orthodontists',
      description: 'Teeth alignment and bite correction specialists.',
      parent: 'Dentistry & Oral Health',
    },

    // Dermatology & Skin subcategories
    {
      name: 'Dermatology',
      description: 'Medical treatment of skin, hair, and nail conditions.',
      parent: 'Dermatology & Skin',
    },

    // Diagnostics & Imaging subcategories
    {
      name: 'Diagnostic Imaging',
      description: 'Medical imaging for diagnosis and treatment planning.',
      parent: 'Diagnostics & Imaging',
    },
    { name: 'Diagnostics', description: 'Medical testing and diagnostic procedures.', parent: 'Diagnostics & Imaging' },
    {
      name: 'Medical Check-up',
      description: 'Preventive health screenings and comprehensive examinations.',
      parent: 'Diagnostics & Imaging',
    },
    {
      name: 'Nuclear Medicine',
      description: 'Radioactive substances for diagnosis and treatment.',
      parent: 'Diagnostics & Imaging',
    },

    // Eye, ENT & Ophthalmology subcategories
    {
      name: 'Ear, Nose and Throat (ENT)',
      description: 'Treatment of ear, nose, throat, and head/neck conditions.',
      parent: 'Eye, ENT & Ophthalmology',
    },
    {
      name: 'Eye Care / Eye Clinics',
      description: 'Comprehensive eye care and vision services.',
      parent: 'Eye, ENT & Ophthalmology',
    },
    {
      name: 'LASIK Laser Eye Surgery',
      description: 'Laser vision correction and refractive surgery.',
      parent: 'Eye, ENT & Ophthalmology',
    },
    {
      name: 'Otorhinolaryngology',
      description: 'Medical and surgical treatment of ear, nose, and throat disorders.',
      parent: 'Eye, ENT & Ophthalmology',
    },
    {
      name: 'Ophthalmology',
      description: 'Medical and surgical eye care and vision treatment.',
      parent: 'Eye, ENT & Ophthalmology',
    },

    // General Practice & Primary Care subcategories
    {
      name: 'Doctors / General Practice',
      description: 'Primary care physicians and general medical practitioners.',
      parent: 'General Practice & Primary Care',
    },

  // Medicine (Non-Surgical Specialties) subcategories
    {
      name: 'Cardiology',
      description: 'Heart and cardiovascular system disorders.',
      parent: 'Medicine (Non-Surgical Specialties)',
    },
    {
      name: 'Endocrinology',
      description: 'Hormone-related diseases and metabolic disorders.',
      parent: 'Medicine (Non-Surgical Specialties)',
    },
    {
      name: 'Gastroenterology',
      description: 'Digestive system disorders and gastrointestinal diseases.',
      parent: 'Medicine (Non-Surgical Specialties)',
    },
  { name: 'Hematology Oncology', description: 'Blood disorders and cancer care.', parent: 'Medicine (Non-Surgical Specialties)' },
  { name: 'Immunology', description: 'Immune system disorders and allergies.', parent: 'Medicine (Non-Surgical Specialties)' },
  { name: 'Infectious Diseases', description: 'Prevention, diagnosis, and treatment of infections.', parent: 'Medicine (Non-Surgical Specialties)' },
  { name: 'Nephrology', description: 'Kidney diseases and renal care.', parent: 'Medicine (Non-Surgical Specialties)' },
  { name: 'Pulmonology', description: 'Lung diseases and respiratory care.', parent: 'Medicine (Non-Surgical Specialties)' },
  { name: 'Rheumatology', description: 'Autoimmune and musculoskeletal disorders.', parent: 'Medicine (Non-Surgical Specialties)' },
  { name: 'Phlebology', description: 'Vein disorders and vascular medicine.', parent: 'Medicine (Non-Surgical Specialties)' },
    {
      name: 'Urology',
      description: 'Urinary tract and male reproductive system conditions.',
      parent: 'Medicine (Non-Surgical Specialties)',
    },

  // Mental Health & Behavioural Sciences subcategories
  { name: 'Narcology & Alcoholism', description: 'Addiction treatment and substance use recovery.', parent: 'Mental Health & Behavioural Sciences' },
  { name: 'Psychiatry', description: 'Diagnosis and treatment of mental disorders.', parent: 'Mental Health & Behavioural Sciences' },
  { name: 'Psychology', description: 'Counseling and psychological services.', parent: 'Mental Health & Behavioural Sciences' },
  { name: 'Psychotherapy / Psychotherapists', description: 'Talk therapy and evidence-based psychotherapy.', parent: 'Mental Health & Behavioural Sciences' },
  { name: 'Sexology', description: 'Sexual health and therapy.', parent: 'Mental Health & Behavioural Sciences' },

  // Pediatrics subcategories
  { name: 'Neonatology', description: 'Medical care for newborn infants.', parent: 'Pediatrics' },
  { name: 'Pediatric Cardiac Surgery', description: 'Heart surgery for infants and children.', parent: 'Pediatrics' },
  { name: 'Pediatric Neurosurgery', description: 'Neurosurgical care for children.', parent: 'Pediatrics' },
  { name: 'Pediatric Oncology', description: 'Cancer care for children and adolescents.', parent: 'Pediatrics' },
  { name: 'Pediatrics', description: 'General pediatric medicine and primary care for children.', parent: 'Pediatrics' },

  // Rehabilitation & Physical Therapy subcategories
  { name: 'Chiropractic Clinics', description: 'Chiropractic diagnostics and manual therapy.', parent: 'Rehabilitation & Physical Therapy' },
  { name: 'Physiotherapy', description: 'Physical therapy and rehabilitation services.', parent: 'Rehabilitation & Physical Therapy' },
  { name: 'Prosthetics & Orthotics', description: 'Assistive devices and mobility solutions.', parent: 'Rehabilitation & Physical Therapy' },
  { name: 'Rehabilitation', description: 'Comprehensive rehabilitation and recovery care.', parent: 'Rehabilitation & Physical Therapy' },
  { name: 'Therapy', description: 'Supportive therapies to restore function and mobility.', parent: 'Rehabilitation & Physical Therapy' },

  // Surgery subcategories
  { name: 'General Surgery', description: 'General surgical procedures for a wide range of conditions.', parent: 'Surgery' },
  { name: 'Hand Surgery', description: 'Surgical treatment of hand and upper extremity disorders.', parent: 'Surgery' },
  { name: 'Heart Surgery', description: 'Cardiac surgery procedures.', parent: 'Surgery' },
  { name: 'Orthopedics', description: 'Musculoskeletal surgery including joints and bones.', parent: 'Surgery' },
  { name: 'Proctology', description: 'Surgical care for rectal and anal disorders.', parent: 'Surgery' },
  { name: 'Spinal Surgery', description: 'Surgical treatment of spinal conditions.', parent: 'Surgery' },

  // Transplant Medicine subcategories
  { name: 'Transplantology', description: 'Organ and tissue transplant procedures.', parent: 'Transplant Medicine' },

  // Weight Management & Metabolic subcategories
  { name: 'Bariatric Surgery', description: 'Weight-loss surgery for severe obesity.', parent: 'Weight Management & Metabolic' },
  { name: 'Weight Loss Surgery', description: 'Surgical interventions for weight loss.', parent: 'Weight Management & Metabolic' },

  // Wellness, Longevity & Spa subcategories
  { name: 'Longevity Health', description: 'Preventive and longevity-oriented health programs.', parent: 'Wellness, Longevity & Spa' },
  { name: 'Spa Resorts with Medical Services', description: 'Wellness resorts offering medical services.', parent: 'Wellness, Longevity & Spa' },
  { name: 'Wellness Retreats', description: 'Comprehensive wellness retreats and programs.', parent: 'Wellness, Longevity & Spa' },

  // Women’s Health & Fertility subcategories
  { name: 'Mammology', description: 'Breast health screening and treatment.', parent: 'Women’s Health & Fertility' },
  { name: 'Obstetrics & Gynecology', description: 'Women’s reproductive health, pregnancy, and childbirth.', parent: 'Women’s Health & Fertility' },
  { name: 'Reproductology', description: 'Reproductive medicine and assisted reproduction.', parent: 'Women’s Health & Fertility' },
  { name: 'Fertility Clinics', description: 'Clinics specializing in fertility treatments.', parent: 'Women’s Health & Fertility' },
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
