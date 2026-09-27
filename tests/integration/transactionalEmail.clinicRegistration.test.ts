import http from 'node:http'
import https from 'node:https'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLocalReq, getPayload, type Payload } from 'payload'
import pg from 'pg'
import config from '@payload-config'
import type { ClinicApplication } from '@/payload-types'
import { bindTransactionalEmail } from '@/features/transactionalEmail/payloadIntegration'
import { createTransactionalEmailWorker } from '@/features/transactionalEmail/worker'
import type { DeliveryAdapter } from '@/features/transactionalEmail/delivery'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { testSlug } from '../fixtures/testSlug'
import { cleanupTransactionalEmailFixtures } from '../fixtures/cleanupTransactionalEmailFixtures'

vi.mock('@/auth/utilities/jwtValidation', () => ({ extractSupabaseUserData: async () => null }))

describe('clinic-registration receipt command', () => {
  let payload: Payload
  let observer: pg.Client
  let specialtyId: number
  const applicationIds: number[] = []
  const operationReferences: string[] = []
  const prefix = testSlug('transactionalEmail.clinicRegistration.test.ts')

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
    const specialties = await payload.find({
      collection: 'medical-specialties',
      depth: 0,
      limit: 1,
      pagination: false,
      where: { parentSpecialty: { exists: false } },
    })
    specialtyId = specialties.docs[0]!.id
    observer = new pg.Client({ connectionString: process.env.DATABASE_URI })
    await observer.connect()
  }, 60000)

  beforeEach(() => {
    vi.stubEnv('CI', 'false')
    const deny = () => {
      throw new Error('External network forbidden')
    }
    vi.spyOn(globalThis, 'fetch').mockImplementation(deny)
    vi.spyOn(http, 'request').mockImplementation(deny)
    vi.spyOn(https, 'request').mockImplementation(deny)
  })

  afterEach(() => {
    expect(globalThis.fetch).not.toHaveBeenCalled()
    expect(http.request).not.toHaveBeenCalled()
    expect(https.request).not.toHaveBeenCalled()
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  afterAll(async () => {
    try {
      await cleanupTransactionalEmailFixtures(payload, operationReferences)
      for (const id of applicationIds)
        await payload.delete({ collection: 'clinicApplications', id, overrideAccess: true })
    } finally {
      await observer?.end()
    }
  })

  async function createApplication() {
    const application = (await payload.create({
      collection: 'clinicApplications',
      data: {
        clinicName: 'Northwind Medical Centre',
        contactFirstName: 'Ada',
        contactLastName: 'Lovelace',
        contactEmail: `${prefix}-${applicationIds.length}@clinic.example`,
        contactRole: 'Clinic Management',
        clinicWebsite: 'https://northwind-clinic.example',
        medicalSpecialties: [specialtyId],
      },
      overrideAccess: true,
      depth: 0,
    } as never)) as ClinicApplication
    applicationIds.push(application.id)
    operationReferences.push(String(application.id))
    return application
  }

  it('prepares exactly one authoritative package receipt and delivers it through the fake seam', async () => {
    const application = await createApplication()
    const req = await createLocalReq({}, payload)
    const commands = bindTransactionalEmail(req)

    await expect(
      commands.accept({
        type: 'clinic.registration-received',
        registrationId: application.id,
        recipientAddress: 'override@example.test',
      } as never),
    ).rejects.toMatchObject({ code: 'invalid-command' })

    const accepted = await commands.accept({ type: 'clinic.registration-received', registrationId: application.id })
    const stored = await observer.query(
      'SELECT command_payload, operation_reference, recipient_address FROM transactional_email_outbox WHERE id = $1',
      [accepted.operationId],
    )
    expect(stored.rows).toEqual([
      expect.objectContaining({
        command_payload: { type: 'clinic.registration-received', registrationId: application.id },
        operation_reference: String(application.id),
        recipient_address: application.contactEmail,
      }),
    ])

    const delivery: DeliveryAdapter = {
      deliver: vi.fn(async () => ({ type: 'accepted' as const, messageId: 'fake-clinic-receipt' })),
    }
    await createTransactionalEmailWorker(req, {
      delivery,
      suppression: async () => 'cleared' as const,
    }).run(accepted.operationId)

    expect(delivery.deliver).toHaveBeenCalledOnce()
    const message = vi.mocked(delivery.deliver).mock.calls[0]![0]!
    expect(message).toMatchObject({
      recipientAddress: application.contactEmail,
      subject: 'We received your clinic registration',
    })
    expect(message.html).toMatch(/Hello,[\s\S]*Ada Lovelace[\s\S]*,/)
    expect(message.html).toContain('Northwind Medical Centre')
    expect(message.text).toContain('findmydoc will review the information and contact you separately.')
    expect(message.text).not.toMatch(/approved|within|days|hours/i)
    expect(
      (
        await observer.query('SELECT count(*)::int AS count FROM transactional_email_events WHERE outbox_id = $1', [
          accepted.operationId,
        ])
      ).rows,
    ).toEqual([{ count: 6 }])
  })

  it.each([
    ['contact email', (id: number) => ({ contactEmail: `${prefix}-changed-${id}@clinic.example` })],
    ['contact first name', () => ({ contactFirstName: 'Grace' })],
    ['contact last name', () => ({ contactLastName: 'Hopper' })],
    ['clinic name', () => ({ clinicName: 'Changed Medical Centre' })],
  ])('fails closed when the authoritative %s changes before fake delivery', async (_, change) => {
    const application = await createApplication()
    const req = await createLocalReq({}, payload)
    const { operationId } = await bindTransactionalEmail(req).accept({
      type: 'clinic.registration-received',
      registrationId: application.id,
    })
    await payload.update({
      collection: 'clinicApplications',
      id: application.id,
      data: change(application.id),
      overrideAccess: true,
      depth: 0,
    } as never)

    const delivery: DeliveryAdapter = { deliver: vi.fn() }
    await createTransactionalEmailWorker(req, {
      delivery,
      suppression: async () => 'cleared' as const,
    }).run(operationId)

    expect(delivery.deliver).not.toHaveBeenCalled()
    expect(
      (
        await observer.query(
          'SELECT state, command_payload, recipient_address FROM transactional_email_outbox WHERE id = $1',
          [operationId],
        )
      ).rows,
    ).toEqual([{ state: 'failed', command_payload: null, recipient_address: null }])
  })
})
