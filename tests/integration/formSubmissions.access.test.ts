import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { testSlug } from '../fixtures/testSlug'
import type { Form, FormSubmission } from '@/payload-types'

type PayloadUser = NonNullable<Parameters<Payload['find']>[0]['user']>

const lexicalMessage = (text: string): NonNullable<Form['confirmationMessage']> => ({
  root: {
    type: 'root',
    children: [
      {
        type: 'paragraph',
        version: 1,
        children: [
          {
            type: 'text',
            text,
            version: 1,
          },
        ],
      },
    ],
    direction: 'ltr',
    format: '',
    indent: 0,
    version: 1,
  },
})

describe('Form submissions access', () => {
  let payload: Payload
  const slugPrefix = testSlug('formSubmissions.access.test.ts')
  const createdFormIds: number[] = []
  const createdSubmissionIds: number[] = []

  const patientUser = {
    id: 900001,
    collection: 'patients',
  } as PayloadUser
  const platformUser = {
    id: 900002,
    collection: 'basicUsers',
    userType: 'platform',
  } as PayloadUser

  beforeAll(async () => {
    payload = await getPayload({ config })
  }, 60000)

  afterEach(async () => {
    while (createdSubmissionIds.length) {
      const id = createdSubmissionIds.pop()
      if (!id) continue
      try {
        await payload.delete({ collection: 'form-submissions', id, overrideAccess: true })
      } catch {}
    }

    while (createdFormIds.length) {
      const id = createdFormIds.pop()
      if (!id) continue
      try {
        await payload.delete({ collection: 'forms', id, overrideAccess: true })
      } catch {}
    }
  })

  it('keeps public create access while restricting stored submissions to Platform Staff', async () => {
    const form = (await payload.create({
      collection: 'forms',
      data: {
        title: `${slugPrefix} access form`,
        slug: `${slugPrefix}-access-form`,
        fields: [
          {
            blockType: 'text',
            name: 'fullName',
            label: 'Full name',
            required: true,
          },
        ],
        confirmationType: 'message',
        confirmationMessage: lexicalMessage('Thank you.'),
      },
      overrideAccess: true,
      depth: 0,
    })) as Form
    createdFormIds.push(form.id)

    const submission = (await payload.create({
      collection: 'form-submissions',
      data: {
        form: form.id,
        submissionData: [{ field: 'fullName', value: 'Jane Patient' }],
      },
      overrideAccess: false,
      depth: 0,
    })) as FormSubmission
    createdSubmissionIds.push(submission.id)

    await expect(
      payload.find({
        collection: 'form-submissions',
        where: { id: { equals: submission.id } },
        user: patientUser,
        overrideAccess: false,
        depth: 0,
      }),
    ).rejects.toThrow()

    await expect(
      payload.update({
        collection: 'form-submissions',
        id: submission.id,
        data: { submissionData: [{ field: 'fullName', value: 'Changed by patient' }] },
        user: patientUser,
        overrideAccess: false,
        depth: 0,
      }),
    ).rejects.toThrow()

    await expect(
      payload.delete({
        collection: 'form-submissions',
        id: submission.id,
        user: patientUser,
        overrideAccess: false,
      }),
    ).rejects.toThrow()

    const platformRead = await payload.find({
      collection: 'form-submissions',
      where: { id: { equals: submission.id } },
      user: platformUser,
      overrideAccess: false,
      depth: 0,
    })
    expect(platformRead.docs).toHaveLength(1)

    const platformUpdated = await payload.update({
      collection: 'form-submissions',
      id: submission.id,
      data: { submissionData: [{ field: 'fullName', value: 'Reviewed by Platform Staff' }] },
      user: platformUser,
      overrideAccess: false,
      depth: 0,
    })
    expect(platformUpdated.submissionData?.[0]?.value).toBe('Reviewed by Platform Staff')

    await payload.delete({
      collection: 'form-submissions',
      id: submission.id,
      user: platformUser,
      overrideAccess: false,
    })
    createdSubmissionIds.splice(createdSubmissionIds.indexOf(submission.id), 1)
  })
})
