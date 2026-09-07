import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { getPayload } from 'payload'
import type { CollectionSlug, Payload } from 'payload'

import config from '@payload-config'
import type { Form, FormSubmission, Redirect } from '@/payload-types'
import { buildRichText } from '../../fixtures/richText'
import { testSlug } from '../../fixtures/testSlug'
import {
  asPayloadStaffUser,
  asPayloadPatientUser,
  cleanupTrackedUsers,
  createClinicTestUser,
  createPatientTestUser,
  createPlatformTestUser,
  type PayloadRequestUser,
} from '../../fixtures/testUsers'

describe('Plugin collection access integration', () => {
  let payload: Payload
  let platformUser: PayloadRequestUser
  let clinicUser: PayloadRequestUser
  let patientUser: PayloadRequestUser

  const slugPrefix = testSlug('pluginCollections-access.test.ts')
  const createdStaffIds: Array<number | string> = []
  const createdPatientIds: Array<number | string> = []
  const createdFormIds: Array<number | string> = []
  const createdSubmissionIds: Array<number | string> = []
  const createdRedirectIds: Array<number | string> = []

  const users = () =>
    [
      ['platform', platformUser],
      ['clinic', clinicUser],
      ['patient', patientUser],
      ['anonymous', undefined],
    ] as const

  const nonPlatformUsers = () => users().filter(([role]) => role !== 'platform')
  const userArg = (user: PayloadRequestUser | undefined) => (user ? { user } : {})

  const cleanup = async (collection: CollectionSlug, ids: Array<number | string>) => {
    while (ids.length) {
      const id = ids.pop()
      if (id === undefined) continue

      try {
        await payload.delete({
          collection,
          id,
          overrideAccess: true,
          context: { disableRevalidate: true },
        })
      } catch {}
    }
  }

  const createForm = async (suffix: string): Promise<Form> => {
    const form = (await payload.create({
      collection: 'forms',
      data: {
        title: `${slugPrefix} ${suffix}`,
        slug: `${slugPrefix}-${suffix}`,
        fields: [
          {
            blockType: 'email',
            label: 'Email',
            name: 'email',
            required: true,
          },
        ],
        confirmationType: 'message',
        confirmationMessage: buildRichText('Thank you.'),
      },
      depth: 0,
      overrideAccess: false,
      user: platformUser,
    })) as Form

    createdFormIds.push(form.id)
    return form
  }

  const createRedirect = async (suffix: string): Promise<Redirect> => {
    const redirect = (await payload.create({
      collection: 'redirects',
      data: {
        from: `/${slugPrefix}-${suffix}-old`,
        to: {
          type: 'custom',
          url: `/${slugPrefix}-${suffix}-new`,
        },
      },
      depth: 0,
      overrideAccess: false,
      user: platformUser,
      context: { disableRevalidate: true },
    })) as Redirect

    createdRedirectIds.push(redirect.id)
    return redirect
  }

  beforeAll(async () => {
    payload = await getPayload({ config })

    const platform = await createPlatformTestUser(payload, {
      emailPrefix: `${slugPrefix}-platform`,
      createdStaffIds,
    })
    const clinic = await createClinicTestUser(payload, {
      emailPrefix: `${slugPrefix}-clinic`,
      createdStaffIds,
    })
    const patient = await createPatientTestUser(payload, {
      emailPrefix: `${slugPrefix}-patient`,
      createdPatientIds,
    })

    platformUser = asPayloadStaffUser(platform)
    clinicUser = asPayloadStaffUser(clinic)
    patientUser = asPayloadPatientUser(patient)
  })

  afterEach(async () => {
    await cleanup('form-submissions', createdSubmissionIds)
    await cleanup('forms', createdFormIds)
    await cleanup('redirects', createdRedirectIds)
  })

  afterAll(async () => {
    await cleanupTrackedUsers(payload, {
      staffIds: createdStaffIds,
      patientIds: createdPatientIds,
    })
  })

  it('keeps forms public and submissions write-only outside platform staff', async () => {
    const form = await createForm('public-form')

    for (const [role, user] of users()) {
      const result = await payload.findByID({
        collection: 'forms',
        id: form.id,
        depth: 0,
        overrideAccess: false,
        ...userArg(user),
      })
      expect(result.id, `form read for ${role}`).toBe(form.id)
    }

    for (const [role, user] of nonPlatformUsers()) {
      await expect(
        payload.create({
          collection: 'forms',
          data: {
            title: `${slugPrefix} blocked ${role}`,
            fields: [],
            confirmationMessage: buildRichText('Blocked.'),
          },
          overrideAccess: false,
          ...userArg(user),
        }),
      ).rejects.toThrow()
      await expect(
        payload.update({
          collection: 'forms',
          id: form.id,
          data: { title: `${slugPrefix} blocked update ${role}` },
          overrideAccess: false,
          ...userArg(user),
        }),
      ).rejects.toThrow()
      await expect(
        payload.delete({
          collection: 'forms',
          id: form.id,
          overrideAccess: false,
          ...userArg(user),
        }),
      ).rejects.toThrow()
    }

    const updatedForm = await payload.update({
      collection: 'forms',
      id: form.id,
      data: { submitButtonLabel: 'Send securely' },
      depth: 0,
      overrideAccess: false,
      user: platformUser,
    })
    expect(updatedForm.submitButtonLabel).toBe('Send securely')

    const submission = (await payload.create({
      collection: 'form-submissions',
      data: {
        form: form.id,
        submissionData: [{ field: 'email', value: 'patient@example.com' }],
      },
      depth: 0,
      overrideAccess: false,
    })) as FormSubmission
    createdSubmissionIds.push(submission.id)

    const platformRead = await payload.findByID({
      collection: 'form-submissions',
      id: submission.id,
      depth: 0,
      overrideAccess: false,
      user: platformUser,
    })
    expect(platformRead.id).toBe(submission.id)

    for (const [role, user] of nonPlatformUsers()) {
      await expect(
        payload.findByID({
          collection: 'form-submissions',
          id: submission.id,
          depth: 0,
          overrideAccess: false,
          ...userArg(user),
        }),
        `submission read for ${role}`,
      ).rejects.toThrow()
      await expect(
        payload.delete({
          collection: 'form-submissions',
          id: submission.id,
          overrideAccess: false,
          ...userArg(user),
        }),
        `submission delete for ${role}`,
      ).rejects.toThrow()
    }

    for (const [role, user] of users()) {
      await expect(
        payload.update({
          collection: 'form-submissions',
          id: submission.id,
          data: { submissionData: [{ field: 'email', value: `${role}@example.com` }] },
          overrideAccess: false,
          ...userArg(user),
        }),
        `submission update for ${role}`,
      ).rejects.toThrow()
    }

    await payload.delete({
      collection: 'form-submissions',
      id: submission.id,
      overrideAccess: false,
      user: platformUser,
    })
  })

  it('keeps redirects public while limiting management to platform staff', async () => {
    const redirect = await createRedirect('public-redirect')

    for (const [role, user] of users()) {
      const result = await payload.findByID({
        collection: 'redirects',
        id: redirect.id,
        depth: 0,
        overrideAccess: false,
        ...userArg(user),
      })
      expect(result.id, `redirect read for ${role}`).toBe(redirect.id)
    }

    for (const [role, user] of nonPlatformUsers()) {
      await expect(
        payload.create({
          collection: 'redirects',
          data: {
            from: `/${slugPrefix}-blocked-${role}`,
            to: { type: 'custom', url: '/blocked' },
          },
          overrideAccess: false,
          ...userArg(user),
        }),
      ).rejects.toThrow()
      await expect(
        payload.update({
          collection: 'redirects',
          id: redirect.id,
          data: { to: { type: 'custom', url: `/blocked-${role}` } },
          overrideAccess: false,
          ...userArg(user),
        }),
      ).rejects.toThrow()
      await expect(
        payload.delete({
          collection: 'redirects',
          id: redirect.id,
          overrideAccess: false,
          ...userArg(user),
        }),
      ).rejects.toThrow()
    }

    const updated = await payload.update({
      collection: 'redirects',
      id: redirect.id,
      data: { to: { type: 'custom', url: `/${slugPrefix}-platform-update` } },
      depth: 0,
      overrideAccess: false,
      user: platformUser,
      context: { disableRevalidate: true },
    })
    expect(updated.to?.url).toBe(`/${slugPrefix}-platform-update`)

    await payload.delete({
      collection: 'redirects',
      id: redirect.id,
      overrideAccess: false,
      user: platformUser,
      context: { disableRevalidate: true },
    })
  })
})
