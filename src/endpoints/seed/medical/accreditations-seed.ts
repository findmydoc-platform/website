import { Payload } from 'payload'
import { upsertByUniqueField, textToRichText } from '../seed-helpers'

/**
 * Seed healthcare accreditations idempotently.
 * @param payload Payload instance
 * @returns created / updated aggregate counts
 */
export async function seedAccreditations(payload: Payload): Promise<{ created: number; updated: number }> {
  payload.logger.info('— Seeding accreditations (idempotent)...')

  const accreditations = [
    {
      name: 'Joint Commission International',
      abbreviation: 'JCI',
      country: 'United States',
      description: textToRichText(
  'Gold standard for international healthcare, focusing on patient safety and quality improvement.',
      ),
    },
    {
      name: 'International Organization for Standardization 9001',
      abbreviation: 'ISO 9001',
      country: 'International',
      description: textToRichText(
        'Certification for quality management systems applicable to clinics and other healthcare organizations.',
      ),
    },
    {
      name: 'TEMOS International',
      abbreviation: 'TEMOS',
      country: 'Germany',
      description: textToRichText(
        'Healthcare accreditation emphasizing patient-centered care, risk management, and international medical tourism standards.',
      ),
    },
    {
      name: 'Australian Council on Healthcare Standards',
      abbreviation: 'ACHS',
      country: 'Australia',
      description: textToRichText(
        'Accreditation framework supporting healthcare quality and safety through rigorous standards and performance assessment.',
      ),
    },
    // Additional accreditations from requirements list
    {
      name: 'Accreditation Canada International',
      abbreviation: 'ACI',
      country: 'Canada',
      description: textToRichText(
        'Evaluates healthcare organizations worldwide against internationally recognized standards.',
      ),
    },
    {
      name: 'Accreditation Canada International Gold',
      abbreviation: 'ACI Gold',
      country: 'Canada',
      description: textToRichText('Accreditation Canada International program level: Gold.'),
    },
    {
      name: 'Accreditation Canada International Diamond',
      abbreviation: 'ACI Diamond',
      country: 'Canada',
      description: textToRichText('Accreditation Canada International program level: Diamond.'),
    },
    {
      name: 'Global Healthcare Accreditation',
      abbreviation: 'GHA',
      country: 'International',
      description: textToRichText(
        'Accreditation for medical travel facilitators and healthcare providers focused on international patients.',
      ),
    },
    {
      name: 'Medical Tourism Association',
      abbreviation: 'MTA',
      country: 'International',
      description: textToRichText('Accreditation programs for healthcare organizations in medical tourism.'),
    },
    {
      name: 'European Society for Cosmetic and Aesthetic Dermatology',
      abbreviation: 'ESCAD',
      country: 'International',
      description: textToRichText('Society focused on standards in cosmetic and aesthetic dermatology.'),
    },
    {
      name: 'Ministry of Health (Turkey)',
      abbreviation: 'MOH',
      country: 'Turkey',
      description: textToRichText('National Ministry of Health in Turkey.'),
    },
    {
      name: 'Association of Turkish Travel Agencies',
      abbreviation: 'TÜRSAB',
      country: 'Turkey',
      description: textToRichText('Association of Turkish Travel Agencies (relevant for medical tourism).'),
    },
    {
      name: 'European Society of Hair Restoration Surgery',
      abbreviation: 'ESHRS',
      country: 'International',
      description: textToRichText('European Society of Hair Restoration Surgery (professional society).'),
    },
    {
      name: 'Turkish Medical Association',
      abbreviation: 'TTB',
      country: 'Turkey',
      description: textToRichText('Turkish Medical Association (national medical chamber).'),
    },
    {
      name: 'Occupational Health & Safety Advisory Service (OHSAS 18001)',
      abbreviation: 'OHSAS',
      country: 'Spain',
      description: textToRichText('Occupational health and safety management system (OHSAS 18001; transition to ISO 45001).'),
    },
    {
      name: 'TÜV Nord DIN EN ISO 9001',
      abbreviation: 'DIN EN ISO 9001',
      country: 'Germany',
      description: textToRichText('Certification according to DIN EN ISO 9001 (TÜV Nord).'),
    },
    {
      name: 'Surgical Review Corporation Bariatric',
      abbreviation: 'SRO Bariatric',
      country: 'United States',
      description: textToRichText('Accreditation for bariatric centers by the Surgical Review Corporation.'),
    },
    {
      name: 'Surgical Review Corporation Colorectal',
      abbreviation: 'SRO Colorectal',
      country: 'United States',
      description: textToRichText('Accreditation for colorectal centers by the Surgical Review Corporation.'),
    },
    {
      name: 'Best Quality Dental Centers',
      abbreviation: 'BQDC',
      country: 'Spain',
      description: textToRichText('Best Quality Dental Centers – network/certification for dental clinics.'),
    },
    {
      name: 'Turkish Society of Plastic Reconstructive and Aesthetic Surgery',
      abbreviation: 'TPRECD',
      country: 'Turkey',
      description: textToRichText('Turkish Society of Plastic Reconstructive and Aesthetic Surgery (professional society).'),
    },
    {
      name: 'Aesthetic Plastic Surgery Association (Turkey)',
      abbreviation: 'EPCD',
      country: 'Turkey',
      description: textToRichText('Aesthetic Plastic Surgery Association (Turkey).'),
    },
    {
      name: 'European Board of Plastic Reconstructive and Aesthetic Surgery',
      abbreviation: 'EBOPRAS',
      country: 'International',
      description: textToRichText('European Board of Plastic Reconstructive and Aesthetic Surgery.'),
    },
    {
      name: 'International Society of Aesthetic Plastic Surgery',
      abbreviation: 'ISAPS',
      country: 'International',
      description: textToRichText('International Society of Aesthetic Plastic Surgery (professional society).'),
    },
    {
      name: 'International Society of Hair Restoration Surgery',
      abbreviation: 'ISHRS',
      country: 'International',
      description: textToRichText('International Society of Hair Restoration Surgery (professional society).'),
    },
    {
      name: 'International Society of Dermatology',
      abbreviation: 'ISD',
      country: 'International',
      description: textToRichText('International Society of Dermatology (professional society).'),
    },
    {
      name: 'International Board of Hair Restoration Specialists',
      abbreviation: 'IBHRS',
      country: 'International',
      description: textToRichText('International Board of Hair Restoration Specialists (certification/board).'),
    },
    {
      name: 'Turkish Society for Reconstructive Microsurgery',
      abbreviation: 'RMCD',
      country: 'Turkey',
      description: textToRichText('Turkish Society for Reconstructive Microsurgery (professional society).'),
    },
    {
      name: 'Confederation of International Beauty Therapy and Cosmetology',
      abbreviation: 'CIBTAC',
      country: 'International',
      description: textToRichText('Confederation/certification for beauty therapy and wellness education.'),
    },
    {
      name: 'International Organization for Standardization 14001',
      abbreviation: 'ISO 14001',
      country: 'International',
      description: textToRichText('Certification for environmental management systems (ISO 14001).'),
    },
    {
      name: 'International Organization for Standardization',
      abbreviation: 'ISO',
      country: 'International',
      description: textToRichText('International Organization for Standardization (generic entry).'),
    },
  ]

  let created = 0
  let updated = 0

  for (const accreditation of accreditations) {
    // Use abbreviation as the matching key to avoid duplicates when names vary
    const res = await upsertByUniqueField(payload, 'accreditation', 'abbreviation', accreditation)
    if (res.created) created++
    if (res.updated) updated++
  }

  payload.logger.info('— Finished seeding accreditations.')
  return { created, updated }
}
