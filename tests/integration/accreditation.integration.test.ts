import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { testSlug } from '../fixtures/testSlug'
import { mockUsers } from '../unit/helpers/mockUsers'

describe('Accreditation Integration Tests', () => {
  let payload: Payload
  const slugPrefix = testSlug('accreditation.integration.test.ts')

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
  })

  afterEach(async () => {
    // Clean up test accreditations
    const { docs } = await payload.find({
      collection: 'accreditation',
      where: { name: { like: `${slugPrefix}%` } },
      limit: 100,
      overrideAccess: true,
    })
    
    for (const doc of docs) {
      await payload.delete({ 
        collection: 'accreditation', 
        id: doc.id, 
        overrideAccess: true 
      })
    }
  })

  describe('Access Control Matrix', () => {
    const accreditationData = {
      name: `${slugPrefix}-Test Accreditation`,
      abbreviation: 'TA',
      country: 'Germany',
      description: [
        {
          children: [{ text: 'Test accreditation for integration testing' }],
        },
      ],
    }

    it('allows public read access for all users', async () => {
      // Create accreditation as platform user
      const created = await payload.create({
        collection: 'accreditation',
        data: accreditationData,
        user: mockUsers.platform(),
      })

      // Anonymous can read
      const readAsAnonymous = await payload.findByID({
        collection: 'accreditation',
        id: created.id,
        user: null,
      })
      expect(readAsAnonymous.id).toBe(created.id)

      // Clinic staff can read
      const readAsClinic = await payload.findByID({
        collection: 'accreditation',
        id: created.id,
        user: mockUsers.clinic(),
      })
      expect(readAsClinic.id).toBe(created.id)

      // Patient can read
      const readAsPatient = await payload.findByID({
        collection: 'accreditation',
        id: created.id,
        user: mockUsers.patient(),
      })
      expect(readAsPatient.id).toBe(created.id)
    })

    it('allows platform staff full CRUD access', async () => {
      // Platform staff can create
      const created = await payload.create({
        collection: 'accreditation',
        data: accreditationData,
        user: mockUsers.platform(),
      })
      expect(created.id).toBeDefined()
      expect(created.name).toBe(accreditationData.name)

      // Platform staff can update
      const updated = await payload.update({
        collection: 'accreditation',
        id: created.id,
        data: { 
          description: [
            {
              children: [{ text: 'Updated description' }],
            },
          ],
        },
        user: mockUsers.platform(),
      })
      expect(updated.description).toEqual([
        {
          children: [{ text: 'Updated description' }],
        },
      ])

      // Platform staff can delete
      await payload.delete({
        collection: 'accreditation',
        id: created.id,
        user: mockUsers.platform(),
      })
    })

    it('restricts creation and modification to platform staff', async () => {
      const restrictedUsers = [
        { user: mockUsers.clinic(), name: 'clinic staff' },
        { user: mockUsers.patient(), name: 'patient' },
        { user: null, name: 'anonymous' },
      ]

      for (const { user, name } of restrictedUsers) {
        await expect(
          payload.create({
            collection: 'accreditation',
            data: {
              ...accreditationData,
              name: `${slugPrefix}-denied-${name}`,
              abbreviation: `D${name.charAt(0).toUpperCase()}`,
            },
            user,
          })
        ).rejects.toThrow()
      }
    })
  })

  describe('Field Validation', () => {
    it('requires name, abbreviation, and country fields', async () => {
      // Missing name
      await expect(
        payload.create({
          collection: 'accreditation',
          data: {
            abbreviation: 'MN',
            country: 'Germany',
            description: [
              {
                children: [{ text: 'Missing name' }],
              },
            ],
          },
          user: mockUsers.platform(),
        })
      ).rejects.toThrow()

      // Missing abbreviation
      await expect(
        payload.create({
          collection: 'accreditation',
          data: {
            name: `${slugPrefix}-Missing Abbreviation`,
            country: 'Germany',
            description: [
              {
                children: [{ text: 'Missing abbreviation' }],
              },
            ],
          },
          user: mockUsers.platform(),
        })
      ).rejects.toThrow()

      // Missing country
      await expect(
        payload.create({
          collection: 'accreditation',
          data: {
            name: `${slugPrefix}-Missing Country`,
            abbreviation: 'MC',
            description: [
              {
                children: [{ text: 'Missing country' }],
              },
            ],
          },
          user: mockUsers.platform(),
        })
      ).rejects.toThrow()
    })

    it('accepts valid accreditation data with all fields', async () => {
      const fullAccreditationData = {
        name: `${slugPrefix}-Complete Accreditation`,
        abbreviation: 'CA',
        country: 'Germany',
        description: [
          {
            children: [{ text: 'Complete accreditation with all required fields' }],
          },
        ],
        validFrom: '2020-01-01',
        validUntil: '2025-12-31',
        issuingOrganization: 'Test Organization',
        website: 'https://example.org',
      }

      const accreditation = await payload.create({
        collection: 'accreditation',
        data: fullAccreditationData,
        user: mockUsers.platform(),
      })

      expect(accreditation.id).toBeDefined()
      expect(accreditation.name).toBe(fullAccreditationData.name)
      expect(accreditation.abbreviation).toBe(fullAccreditationData.abbreviation)
      expect(accreditation.country).toBe(fullAccreditationData.country)
      expect(accreditation.description).toEqual([
        {
          children: [{ text: 'Complete accreditation with all required fields' }],
        },
      ])
    })

    it('accepts optional fields when provided', async () => {
      const accreditation = await payload.create({
        collection: 'accreditation',
        data: {
          name: `${slugPrefix}-With Optional Fields`,
          abbreviation: 'WOF',
          country: 'Germany',
          description: [
            {
              children: [{ text: 'Accreditation with optional fields' }],
            },
          ],
          validFrom: '2022-01-01',
          validUntil: '2027-12-31',
          issuingOrganization: 'International Standards Board',
          website: 'https://standards.example.org',
        },
        user: mockUsers.platform(),
      })

      expect(accreditation.validFrom).toBe('2022-01-01')
      expect(accreditation.validUntil).toBe('2027-12-31')
      expect(accreditation.issuingOrganization).toBe('International Standards Board')
      expect(accreditation.website).toBe('https://standards.example.org')
    })
  })

  describe('Accreditation Use Cases', () => {
    it('can be used for clinic quality standards', async () => {
      // Create an accreditation that could be linked to clinics
      const qualityAccreditation = await payload.create({
        collection: 'accreditation',
        data: {
          name: `${slugPrefix}-ISO 9001 Quality Management`,
          abbreviation: 'ISO9001',
          country: 'International',
          description: [
            {
              children: [{ text: 'International standard for quality management systems' }],
            },
          ],
          issuingOrganization: 'International Organization for Standardization',
          website: 'https://www.iso.org',
        },
        user: mockUsers.platform(),
      })

      expect(qualityAccreditation.id).toBeDefined()
      expect(qualityAccreditation.name).toContain('Quality Management')
      expect(qualityAccreditation.abbreviation).toBe('ISO9001')

      // This accreditation could be referenced by clinics
      // The actual clinic-accreditation relationship testing would be done
      // in clinic tests if such a relationship exists
    })

    it('supports country-specific accreditations', async () => {
      const germanAccreditation = await payload.create({
        collection: 'accreditation',
        data: {
          name: `${slugPrefix}-KTQ Certification`,
          abbreviation: 'KTQ',
          country: 'Germany',
          description: [
            {
              children: [{ text: 'German hospital quality certification' }],
            },
          ],
          issuingOrganization: 'KTQ GmbH',
        },
        user: mockUsers.platform(),
      })

      const usAccreditation = await payload.create({
        collection: 'accreditation',
        data: {
          name: `${slugPrefix}-AAAHC Accreditation`,
          abbreviation: 'AAAHC',
          country: 'United States',
          description: [
            {
              children: [{ text: 'Ambulatory healthcare accreditation' }],
            },
          ],
          issuingOrganization: 'Accreditation Association for Ambulatory Health Care',
        },
        user: mockUsers.platform(),
      })

      // Query accreditations by country
      const germanAccreditations = await payload.find({
        collection: 'accreditation',
        where: { country: { equals: 'Germany' } },
        user: mockUsers.platform(),
      })

      const usAccreditations = await payload.find({
        collection: 'accreditation',
        where: { country: { equals: 'United States' } },
        user: mockUsers.platform(),
      })

      expect(germanAccreditations.docs.some(acc => acc.id === germanAccreditation.id)).toBe(true)
      expect(usAccreditations.docs.some(acc => acc.id === usAccreditation.id)).toBe(true)

      // Clean up
      await payload.delete({ collection: 'accreditation', id: germanAccreditation.id, overrideAccess: true })
      await payload.delete({ collection: 'accreditation', id: usAccreditation.id, overrideAccess: true })
    })
  })

  describe('Query and Filtering', () => {
    it('supports searching by name and abbreviation', async () => {
      const acc1 = await payload.create({
        collection: 'accreditation',
        data: {
          name: `${slugPrefix}-Joint Commission`,
          abbreviation: 'JC',
          country: 'United States',
          description: [
            {
              children: [{ text: 'Healthcare accreditation' }],
            },
          ],
        },
        user: mockUsers.platform(),
      })

      const acc2 = await payload.create({
        collection: 'accreditation',
        data: {
          name: `${slugPrefix}-Commission on Accreditation`,
          abbreviation: 'COA',
          country: 'United States',
          description: [
            {
              children: [{ text: 'Another healthcare accreditation' }],
            },
          ],
        },
        user: mockUsers.platform(),
      })

      // Search by name containing "Commission"
      const commissionResults = await payload.find({
        collection: 'accreditation',
        where: { name: { like: '%Commission%' } },
        user: mockUsers.platform(),
      })

      const ourCommissionResults = commissionResults.docs.filter(acc => 
        acc.name.includes(slugPrefix)
      )
      expect(ourCommissionResults).toHaveLength(2)

      // Search by specific abbreviation
      const jcResults = await payload.find({
        collection: 'accreditation',
        where: { abbreviation: { equals: 'JC' } },
        user: mockUsers.platform(),
      })

      expect(jcResults.docs.some(acc => acc.id === acc1.id)).toBe(true)

      // Clean up
      await payload.delete({ collection: 'accreditation', id: acc1.id, overrideAccess: true })
      await payload.delete({ collection: 'accreditation', id: acc2.id, overrideAccess: true })
    })

    it('supports filtering by country', async () => {
      const germanAcc = await payload.create({
        collection: 'accreditation',
        data: {
          name: `${slugPrefix}-German Quality Standard`,
          abbreviation: 'GQS',
          country: 'Germany',
          description: [
            {
              children: [{ text: 'German quality standard' }],
            },
          ],
        },
        user: mockUsers.platform(),
      })

      const frenchAcc = await payload.create({
        collection: 'accreditation',
        data: {
          name: `${slugPrefix}-French Quality Standard`,
          abbreviation: 'FQS',
          country: 'France',
          description: [
            {
              children: [{ text: 'French quality standard' }],
            },
          ],
        },
        user: mockUsers.platform(),
      })

      // Filter by country
      const germanResults = await payload.find({
        collection: 'accreditation',
        where: { country: { equals: 'Germany' } },
        user: mockUsers.platform(),
      })

      const frenchResults = await payload.find({
        collection: 'accreditation',
        where: { country: { equals: 'France' } },
        user: mockUsers.platform(),
      })

      expect(germanResults.docs.some(acc => acc.id === germanAcc.id)).toBe(true)
      expect(frenchResults.docs.some(acc => acc.id === frenchAcc.id)).toBe(true)

      // Clean up
      await payload.delete({ collection: 'accreditation', id: germanAcc.id, overrideAccess: true })
      await payload.delete({ collection: 'accreditation', id: frenchAcc.id, overrideAccess: true })
    })
  })

  describe('Data Integrity', () => {
    it('maintains consistent naming and abbreviation patterns', async () => {
      const accreditation = await payload.create({
        collection: 'accreditation',
        data: {
          name: `${slugPrefix}-Test Standard Certification`,
          abbreviation: 'TSC',
          country: 'International',
          description: [
            {
              children: [{ text: 'Test for naming consistency' }],
            },
          ],
        },
        user: mockUsers.platform(),
      })

      expect(accreditation.name).toBeTruthy()
      expect(accreditation.abbreviation).toBeTruthy()
      expect(accreditation.name.length).toBeGreaterThan(0)
      expect(accreditation.abbreviation.length).toBeGreaterThan(0)
      expect(accreditation.abbreviation.length).toBeLessThanOrEqual(20) // Reasonable abbreviation length
    })

    it('handles international and country-specific standards', async () => {
      const internationalStandard = await payload.create({
        collection: 'accreditation',
        data: {
          name: `${slugPrefix}-WHO International Standard`,
          abbreviation: 'WHO-IS',
          country: 'International',
          description: [
            {
              children: [{ text: 'World Health Organization international standard' }],
            },
          ],
          issuingOrganization: 'World Health Organization',
        },
        user: mockUsers.platform(),
      })

      const nationalStandard = await payload.create({
        collection: 'accreditation',
        data: {
          name: `${slugPrefix}-National Health Service Standard`,
          abbreviation: 'NHS-STD',
          country: 'United Kingdom',
          description: [
            {
              children: [{ text: 'UK National Health Service standard' }],
            },
          ],
          issuingOrganization: 'NHS England',
        },
        user: mockUsers.platform(),
      })

      expect(internationalStandard.country).toBe('International')
      expect(nationalStandard.country).toBe('United Kingdom')
      expect(internationalStandard.issuingOrganization).toBe('World Health Organization')
      expect(nationalStandard.issuingOrganization).toBe('NHS England')

      // Clean up
      await payload.delete({ collection: 'accreditation', id: internationalStandard.id, overrideAccess: true })
      await payload.delete({ collection: 'accreditation', id: nationalStandard.id, overrideAccess: true })
    })
  })
})