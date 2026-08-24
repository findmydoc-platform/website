import { describe, expect, it } from 'vitest'

import { InquiryConversations } from '@/collections/InquiryConversations'
import { InquiryInternalNotes } from '@/collections/InquiryInternalNotes'
import { InquiryMessages } from '@/collections/InquiryMessages'
import { PatientClinicInquiries } from '@/collections/PatientClinicInquiries'

const communicationTrashMatrix = [
  ['patientClinicInquiries', PatientClinicInquiries],
  ['inquiryConversations', InquiryConversations],
  ['inquiryMessages', InquiryMessages],
  ['inquiryInternalNotes', InquiryInternalNotes],
] as const

describe('inquiry communication soft-delete matrix', () => {
  it.each(communicationTrashMatrix)('%s remains Payload-trash restorable', (slug, collection) => {
    expect(collection.slug).toBe(slug)
    expect(collection.trash).toBe(true)
    expect(collection.versions).toBeUndefined()
    expect(collection.access).toMatchObject({
      admin: expect.any(Function),
      create: expect.any(Function),
      delete: expect.any(Function),
      read: expect.any(Function),
      update: expect.any(Function),
    })
  })
})
