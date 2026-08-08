import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createLocalReq, getPayload, type Payload, type TypedUser } from 'payload'
import config from '@payload-config'

import type { Review, ReviewResponse } from '@/payload-types'
import {
  reviewModerationPostHandler,
  reviewPublicationHistoryGetHandler,
  reviewWithdrawalCorrectionPostHandler,
  reviewWithdrawPostHandler,
} from '@/collections/reviews/endpoints'
import { REVIEW_PLACEHOLDER_NOTICE, REVIEW_REDACTION_NOTICE } from '@/collections/reviews/publicProjection'
import {
  countApprovedClinicReviews,
  countApprovedDoctorReviews,
  findApprovedClinicReviewsByClinicId,
} from '@/utilities/clinicDetail/serverData/repositories'
import {
  countApprovedReviewsByClinic,
  findLatestApprovedReviewDateForClinics,
} from '@/utilities/listingComparison/serverData/repositories'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { testSlug } from '../fixtures/testSlug'
import {
  asClinicScopedPayloadUser,
  asPayloadPatientUser,
  asPayloadStaffUser,
  cleanupTrackedUsers,
  createClinicTestUser,
  createPatientTestUser,
  createPlatformTestUser,
} from '../fixtures/testUsers'

const relationId = (value: unknown): string | number | null => {
  if (typeof value === 'number' || typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value) return relationId((value as { id?: unknown }).id)
  return null
}

describe('review public moderation and author withdrawal', () => {
  let payload: Payload
  let cityId: number
  let treatmentId: number
  const slugPrefix = testSlug('reviews.publication.test.ts')
  const reviewIds: Array<number | string> = []
  const responseIds: Array<number | string> = []
  const staffIds: Array<number | string> = []
  const patientIds: Array<number | string> = []

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)

    const [cities, treatments] = await Promise.all([
      payload.find({ collection: 'cities', limit: 1, overrideAccess: true }),
      payload.find({ collection: 'treatments', limit: 1, overrideAccess: true }),
    ])
    const city = cities.docs[0]
    const treatment = treatments.docs[0]
    if (!city || !treatment) throw new Error('Expected baseline city and treatment for review publication tests')
    cityId = city.id as number
    treatmentId = treatment.id as number
  }, 60000)

  afterEach(async () => {
    while (responseIds.length) {
      const id = responseIds.pop()
      if (!id) continue
      try {
        await payload.delete({ collection: 'reviewResponses', id, overrideAccess: true })
      } catch {}
    }

    while (reviewIds.length) {
      const id = reviewIds.pop()
      if (!id) continue
      try {
        await payload.delete({ collection: 'reviews', id, overrideAccess: true })
      } catch {}
    }

    await cleanupTrackedUsers(payload, { staffIds, patientIds })
    await cleanupTestEntities(payload, 'doctors', slugPrefix)
    await cleanupTestEntities(payload, 'clinics', slugPrefix)
  })

  const endpointRequest = async (
    user: TypedUser | null | undefined,
    id: number | string,
    body?: unknown,
    query = '',
  ) => {
    const req = await createLocalReq({ ...(user ? { user } : {}) }, payload)
    req.routeParams = { id }
    req.json = async () => body
    for (const [key, value] of new URLSearchParams(query)) {
      req.searchParams.append(key, value)
    }
    return req
  }

  const readPublicReview = async (id: number | string, user?: TypedUser) =>
    payload.find({
      collection: 'reviews',
      where: { id: { equals: id } },
      ...(user ? { user } : {}),
      overrideAccess: false,
      depth: 0,
    })

  const readPublicResponse = async (reviewId: number | string) =>
    payload.find({
      collection: 'reviewResponses',
      where: { review: { equals: reviewId } },
      overrideAccess: false,
      depth: 0,
    })

  async function createScenario(suffix: string) {
    const [{ clinic, doctor }, { clinic: foreignClinic }] = await Promise.all([
      createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-${suffix}-own` }),
      createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-${suffix}-foreign` }),
    ])
    const [patient, otherPatient, moderator, ownClinicStaff, foreignClinicStaff] = await Promise.all([
      createPatientTestUser(payload, {
        emailPrefix: `${slugPrefix}-${suffix}-patient`,
        firstName: 'Maya',
        lastName: 'Keller',
        createdPatientIds: patientIds,
      }),
      createPatientTestUser(payload, {
        emailPrefix: `${slugPrefix}-${suffix}-other-patient`,
        createdPatientIds: patientIds,
      }),
      createPlatformTestUser(payload, {
        emailPrefix: `${slugPrefix}-${suffix}-platform`,
        createdStaffIds: staffIds,
      }),
      createClinicTestUser(payload, {
        emailPrefix: `${slugPrefix}-${suffix}-own-clinic`,
        createdStaffIds: staffIds,
      }),
      createClinicTestUser(payload, {
        emailPrefix: `${slugPrefix}-${suffix}-foreign-clinic`,
        createdStaffIds: staffIds,
      }),
    ])
    const platformUser = asPayloadStaffUser(moderator)
    const patientUser = asPayloadPatientUser(patient)
    const otherPatientUser = asPayloadPatientUser(otherPatient)
    const ownClinicUser = await asClinicScopedPayloadUser(payload, ownClinicStaff, clinic.id)
    const foreignClinicUser = await asClinicScopedPayloadUser(payload, foreignClinicStaff, foreignClinic.id)

    const review = await payload.create({
      collection: 'reviews',
      data: {
        patient: patient.id,
        clinic: clinic.id,
        doctor: doctor.id,
        treatment: treatmentId,
        starRating: 5,
        comment: 'Original private detail: patient@example.com. Care was otherwise excellent.',
        status: 'approved',
        authorVisibility: 'firstNameInitial',
      } as unknown as Review,
      overrideAccess: true,
      depth: 0,
    })
    reviewIds.push(review.id)

    const pendingResponse = await payload.create({
      collection: 'reviewResponses',
      data: {
        review: review.id,
        pendingResponse: {
          body: 'Thank you for sharing your experience. We appreciate the clear feedback.',
        },
      } as unknown as ReviewResponse,
      user: ownClinicUser,
      overrideAccess: false,
      depth: 0,
    })
    responseIds.push(pendingResponse.id)
    await payload.update({
      collection: 'reviewResponses',
      id: pendingResponse.id,
      data: { moderationStatus: 'approved' } as unknown as ReviewResponse,
      user: platformUser,
      overrideAccess: false,
      depth: 0,
    })

    return {
      review,
      platformUser,
      patientUser,
      otherPatientUser,
      ownClinicUser,
      foreignClinicUser,
    }
  }

  it('applies all five measures while preserving the original review, rating, status, and native audit history', async () => {
    const { review, platformUser, patientUser, ownClinicUser, foreignClinicUser } = await createScenario('measures')
    const clinicId = relationId(review.clinic)
    const doctorId = relationId(review.doctor)
    if (typeof clinicId !== 'number' || typeof doctorId !== 'number') {
      throw new Error('Expected numeric clinic and doctor ids for public repository checks')
    }

    expect((await readPublicReview(review.id)).docs).toHaveLength(1)
    expect((await readPublicResponse(review.id)).docs).toHaveLength(1)
    await expect(countApprovedClinicReviews(payload, clinicId)).resolves.toBe(1)
    await expect(findApprovedClinicReviewsByClinicId(payload, clinicId)).resolves.toHaveLength(1)
    await expect(countApprovedDoctorReviews(payload, [doctorId])).resolves.toEqual(new Map([[doctorId, 1]]))
    await expect(findLatestApprovedReviewDateForClinics(payload, [clinicId])).resolves.toBe(review.reviewDate)
    await expect(countApprovedReviewsByClinic(payload, [clinicId])).resolves.toEqual(new Map([[clinicId, 1]]))

    const contextResponse = await reviewModerationPostHandler(
      await endpointRequest(platformUser, review.id, {
        measure: 'context',
        reason: 'Factual platform context is required.',
        publicNotice: 'findmydoc verified an administrative date referenced in this review.',
      }),
    )
    expect(contextResponse.status).toBe(200)
    expect(contextResponse.headers.get('cache-control')).toContain('private, no-store')
    expect(contextResponse.headers.get('vary')).toBe('Authorization')
    const contextRead = await readPublicReview(review.id)
    expect(contextRead.docs[0]).toMatchObject({
      publicMeasure: 'context',
      comment: 'Original private detail: patient@example.com. Care was otherwise excellent.',
      publicNotice: 'findmydoc verified an administrative date referenced in this review.',
    })
    expect((await readPublicResponse(review.id)).docs).toHaveLength(1)

    const redactionResponse = await reviewModerationPostHandler(
      await endpointRequest(platformUser, review.id, {
        measure: 'redaction',
        reason: 'The email address is personal data.',
        publicComment: 'Care was otherwise excellent.',
      }),
    )
    expect(redactionResponse.status).toBe(200)
    const redactionRead = await readPublicReview(review.id)
    expect(redactionRead.docs[0]).toMatchObject({
      publicMeasure: 'redaction',
      publicComment: 'Care was otherwise excellent.',
      publicNotice: REVIEW_REDACTION_NOTICE,
    })
    expect(redactionRead.docs[0]).not.toHaveProperty('comment')
    expect(redactionRead.docs[0]).not.toHaveProperty('moderatedAt')
    expect(redactionRead.docs[0]).not.toHaveProperty('moderationReason')
    expect(redactionRead.docs[0]).not.toHaveProperty('withdrawalState')
    expect((await readPublicResponse(review.id)).docs).toHaveLength(1)

    const ownClinicRead = await readPublicReview(review.id, ownClinicUser)
    expect(ownClinicRead.docs[0]).toMatchObject({
      publicMeasure: 'redaction',
      publicComment: 'Care was otherwise excellent.',
      publicNotice: REVIEW_REDACTION_NOTICE,
      withdrawalState: 'active',
    })
    expect(ownClinicRead.docs[0]).toHaveProperty('moderatedAt')
    expect(ownClinicRead.docs[0]).not.toHaveProperty('comment')
    expect(ownClinicRead.docs[0]).not.toHaveProperty('patient')
    expect(ownClinicRead.docs[0]).not.toHaveProperty('moderationReason')
    expect(ownClinicRead.docs[0]).not.toHaveProperty('moderatedBy')
    expect((await readPublicReview(review.id, foreignClinicUser)).docs).toHaveLength(0)

    const placeholderResponse = await reviewModerationPostHandler(
      await endpointRequest(platformUser, review.id, {
        measure: 'placeholder',
        reason: 'No coherent review text can remain public.',
      }),
    )
    expect(placeholderResponse.status).toBe(200)
    const placeholderRead = await readPublicReview(review.id, patientUser)
    expect(placeholderRead.totalDocs).toBe(1)
    expect(placeholderRead.docs[0]).toMatchObject({
      publicMeasure: 'placeholder',
      publicNotice: REVIEW_PLACEHOLDER_NOTICE,
      starRating: 5,
    })
    expect(placeholderRead.docs[0]).not.toHaveProperty('comment')
    expect(placeholderRead.docs[0]).toHaveProperty('publicComment', null)
    expect((await readPublicResponse(review.id)).docs).toHaveLength(0)

    const removedResponse = await reviewModerationPostHandler(
      await endpointRequest(platformUser, review.id, {
        measure: 'removed',
        reason: 'The complete review must be removed from public output.',
      }),
    )
    expect(removedResponse.status).toBe(200)
    expect((await readPublicReview(review.id)).docs).toHaveLength(0)
    expect((await readPublicReview(review.id, patientUser)).docs).toHaveLength(0)
    expect((await readPublicResponse(review.id)).docs).toHaveLength(0)

    const restoredNone = await reviewModerationPostHandler(
      await endpointRequest(platformUser, review.id, {
        measure: 'none',
        reason: 'A platform correction restored the unchanged review.',
      }),
    )
    expect(restoredNone.status).toBe(200)
    const noneRead = await readPublicReview(review.id)
    expect(noneRead.docs[0]).toMatchObject({
      publicMeasure: 'none',
      comment: 'Original private detail: patient@example.com. Care was otherwise excellent.',
      starRating: 5,
      status: 'approved',
    })
    expect(noneRead.docs[0]?.publicComment).toBeFalsy()
    expect(noneRead.docs[0]?.publicNotice).toBeFalsy()
    expect((await readPublicResponse(review.id)).docs).toHaveLength(1)

    const platformRead = await payload.findByID({
      collection: 'reviews',
      id: review.id,
      user: platformUser,
      overrideAccess: false,
      depth: 0,
    })
    expect(platformRead.comment).toBe('Original private detail: patient@example.com. Care was otherwise excellent.')
    expect(platformRead.starRating).toBe(5)
    expect(platformRead.status).toBe('approved')

    const versions = await payload.findVersions({
      collection: 'reviews',
      where: { parent: { equals: review.id } },
      user: platformUser,
      overrideAccess: false,
      depth: 0,
      pagination: false,
    })
    expect(versions.docs.map((version) => version.version.publicMeasure)).toEqual(
      expect.arrayContaining(['none', 'context', 'redaction', 'placeholder', 'removed']),
    )
    expect(versions.docs.every((version) => version.version.comment === platformRead.comment)).toBe(true)
  }, 60000)

  it('paginates native history without overlap or gaps and invalidates cursors after a review change', async () => {
    const { review, platformUser, ownClinicUser } = await createScenario('history-pagination')

    for (const sequence of [1, 2, 3, 4, 5]) {
      const response = await reviewModerationPostHandler(
        await endpointRequest(platformUser, review.id, {
          measure: 'context',
          reason: `Audit history pagination fixture ${sequence}.`,
          publicNotice: `Verified context ${sequence}.`,
        }),
      )
      expect(response.status).toBe(200)
    }

    const nativeVersions = await payload.findVersions({
      collection: 'reviews',
      where: { parent: { equals: review.id } },
      limit: 100,
      pagination: false,
      sort: ['-createdAt', '-id'],
      overrideAccess: true,
      depth: 0,
    })
    const expectedIds = nativeVersions.docs.map((version) => relationId(version.id))
    expect(expectedIds.length).toBeGreaterThan(2)

    const deliveredIds: Array<number | string | null> = []
    let cursor: string | null = null
    let pageCount = 0

    do {
      const query = new URLSearchParams({ limit: '2' })
      if (cursor) query.set('cursor', cursor)
      const response = await reviewPublicationHistoryGetHandler(
        await endpointRequest(ownClinicUser, review.id, undefined, query.toString()),
      )
      expect(response.status).toBe(200)
      expect(response.headers.get('cache-control')).toContain('private, no-store')

      const body = (await response.json()) as {
        data: {
          pagination: { hasNextPage: boolean; limit: number; nextCursor: string | null }
          versions: Array<{ id: number | string | null }>
        }
      }
      expect(body.data.pagination.limit).toBe(2)
      expect(body.data.pagination.hasNextPage).toBe(body.data.pagination.nextCursor !== null)
      deliveredIds.push(...body.data.versions.map((version) => version.id))
      cursor = body.data.pagination.nextCursor
      pageCount += 1
      expect(pageCount).toBeLessThanOrEqual(expectedIds.length)
    } while (cursor)

    expect(deliveredIds).toEqual(expectedIds)
    expect(new Set(deliveredIds).size).toBe(deliveredIds.length)

    const firstPageResponse = await reviewPublicationHistoryGetHandler(
      await endpointRequest(ownClinicUser, review.id, undefined, 'limit=1'),
    )
    const firstPage = (await firstPageResponse.json()) as {
      data: { pagination: { nextCursor: string | null } }
    }
    expect(firstPage.data.pagination.nextCursor).toEqual(expect.any(String))

    const changed = await reviewModerationPostHandler(
      await endpointRequest(platformUser, review.id, {
        measure: 'context',
        reason: 'This creates a newer review revision.',
        publicNotice: 'Verified context after pagination.',
      }),
    )
    expect(changed.status).toBe(200)

    const staleCursorResponse = await reviewPublicationHistoryGetHandler(
      await endpointRequest(
        ownClinicUser,
        review.id,
        undefined,
        new URLSearchParams({ limit: '1', cursor: String(firstPage.data.pagination.nextCursor) }).toString(),
      ),
    )
    expect(staleCursorResponse.status).toBe(409)
    await expect(staleCursorResponse.json()).resolves.toEqual({ error: { code: 'HISTORY_CHANGED' } })
  }, 60000)

  it('withdraws idempotently, enforces ownership and terminal state, and exposes only tenant-safe history', async () => {
    const { review, platformUser, patientUser, otherPatientUser, ownClinicUser, foreignClinicUser } =
      await createScenario('withdrawal')

    const clinicModeration = await reviewModerationPostHandler(
      await endpointRequest(ownClinicUser, review.id, {
        measure: 'removed',
        reason: 'Clinic staff cannot moderate reviews.',
      }),
    )
    expect(clinicModeration.status).toBe(403)
    const clinicWithdrawal = await reviewWithdrawPostHandler(await endpointRequest(ownClinicUser, review.id, {}))
    expect(clinicWithdrawal.status).toBe(403)

    await reviewModerationPostHandler(
      await endpointRequest(platformUser, review.id, {
        measure: 'redaction',
        reason: 'The first public redaction still contains personal data.',
        publicComment: 'Unsafe redacted variant: patient@example.com.',
      }),
    )

    await reviewModerationPostHandler(
      await endpointRequest(platformUser, review.id, {
        measure: 'redaction',
        reason: 'The email address is personal data.',
        publicComment: 'Care was otherwise excellent.',
      }),
    )

    const beforeWithdrawal = await payload.findVersions({
      collection: 'reviews',
      where: { parent: { equals: review.id } },
      overrideAccess: true,
      depth: 0,
      pagination: false,
    })

    const wrongAuthor = await reviewWithdrawPostHandler(await endpointRequest(otherPatientUser, review.id, {}))
    expect(wrongAuthor.status).toBe(404)

    const withdrawn = await reviewWithdrawPostHandler(await endpointRequest(patientUser, review.id, {}))
    expect(withdrawn.status).toBe(200)
    await expect(withdrawn.json()).resolves.toMatchObject({
      data: { publicMeasure: 'redaction', withdrawalState: 'withdrawn', withdrawalSource: 'patient' },
    })
    expect((await readPublicReview(review.id)).docs).toHaveLength(0)
    expect((await readPublicResponse(review.id)).docs).toHaveLength(0)

    const afterWithdrawal = await payload.findVersions({
      collection: 'reviews',
      where: { parent: { equals: review.id } },
      overrideAccess: true,
      depth: 0,
      pagination: false,
    })
    expect(afterWithdrawal.docs).toHaveLength(beforeWithdrawal.docs.length + 1)

    const repeated = await reviewWithdrawPostHandler(await endpointRequest(patientUser, review.id, {}))
    expect(repeated.status).toBe(200)
    const afterRepeated = await payload.findVersions({
      collection: 'reviews',
      where: { parent: { equals: review.id } },
      overrideAccess: true,
      depth: 0,
      pagination: false,
    })
    expect(afterRepeated.docs).toHaveLength(afterWithdrawal.docs.length)

    const withdrawnHistoryResponse = await reviewPublicationHistoryGetHandler(
      await endpointRequest(ownClinicUser, review.id),
    )
    expect(withdrawnHistoryResponse.status).toBe(200)
    const withdrawnHistory = (await withdrawnHistoryResponse.json()) as {
      data: { versions: Array<Record<string, unknown>> }
    }
    expect(withdrawnHistory.data.versions.every((version) => version.publicText === null)).toBe(true)
    expect(withdrawnHistory.data.versions.every((version) => version.publicNotice === null)).toBe(true)
    expect(JSON.stringify(withdrawnHistory)).not.toContain('patient@example.com')

    const terminalModeration = await reviewModerationPostHandler(
      await endpointRequest(platformUser, review.id, {
        measure: 'none',
        reason: 'This must fail until the withdrawal is corrected.',
      }),
    )
    expect(terminalModeration.status).toBe(409)
    await expect(terminalModeration.json()).resolves.toEqual({ error: { code: 'REVIEW_WITHDRAWN' } })

    const patientCorrection = await reviewWithdrawalCorrectionPostHandler(
      await endpointRequest(patientUser, review.id, { reason: 'Patients cannot correct audit state.' }),
    )
    expect(patientCorrection.status).toBe(403)

    const corrected = await reviewWithdrawalCorrectionPostHandler(
      await endpointRequest(platformUser, review.id, {
        reason: 'Verified operator correction of an erroneous withdrawal.',
      }),
    )
    expect(corrected.status).toBe(200)
    await expect(corrected.json()).resolves.toMatchObject({
      data: { publicMeasure: 'redaction', withdrawalState: 'active', withdrawalSource: 'platform' },
    })
    const publicAfterCorrection = await readPublicReview(review.id)
    expect(publicAfterCorrection.docs).toHaveLength(1)
    expect(publicAfterCorrection.docs[0]).toMatchObject({
      publicMeasure: 'redaction',
      publicComment: 'Care was otherwise excellent.',
    })
    expect(publicAfterCorrection.docs[0]).not.toHaveProperty('comment')
    expect((await readPublicResponse(review.id)).docs).toHaveLength(1)

    const clinicCurrent = await readPublicReview(review.id, ownClinicUser)
    expect(clinicCurrent.docs[0]).toMatchObject({
      publicMeasure: 'redaction',
      withdrawalState: 'active',
      withdrawalSource: 'platform',
    })
    expect(clinicCurrent.docs[0]).not.toHaveProperty('comment')
    expect(clinicCurrent.docs[0]).not.toHaveProperty('withdrawalReason')
    expect(clinicCurrent.docs[0]).not.toHaveProperty('withdrawnBy')

    const ownHistoryResponse = await reviewPublicationHistoryGetHandler(await endpointRequest(ownClinicUser, review.id))
    expect(ownHistoryResponse.status).toBe(200)
    expect(ownHistoryResponse.headers.get('cache-control')).toContain('private, no-store')
    expect(ownHistoryResponse.headers.get('vary')).toBe('Authorization')
    const ownHistory = (await ownHistoryResponse.json()) as {
      data: { versions: Array<Record<string, unknown>> }
    }
    expect(ownHistory.data.versions.length).toBeGreaterThanOrEqual(4)
    expect(ownHistory.data.versions.some((version) => version.publicText === 'Care was otherwise excellent.')).toBe(
      true,
    )
    expect(
      ownHistory.data.versions
        .filter((version) => version.publicText === null)
        .every((version) => version.publicNotice === null && version.publicAuthorName === null),
    ).toBe(true)
    const serializedHistory = JSON.stringify(ownHistory)
    expect(serializedHistory).not.toContain('patient@example.com')
    expect(serializedHistory).not.toContain('Unsafe redacted variant')
    expect(serializedHistory).not.toContain('moderationReason')
    expect(serializedHistory).not.toContain('withdrawalReason')
    expect(serializedHistory).not.toContain('moderatedBy')
    expect(serializedHistory).not.toContain('withdrawnBy')
    expect(serializedHistory).not.toContain('"patient":')
    expect(
      ownHistory.data.versions.every((version) =>
        ['patient', 'platform_staff', 'system'].includes(String(version.actorType)),
      ),
    ).toBe(true)

    const platformHistory = await reviewPublicationHistoryGetHandler(await endpointRequest(platformUser, review.id))
    expect(platformHistory.status).toBe(200)
    const wrongTenantHistory = await reviewPublicationHistoryGetHandler(
      await endpointRequest(foreignClinicUser, review.id),
    )
    expect(wrongTenantHistory.status).toBe(404)
    const patientHistory = await reviewPublicationHistoryGetHandler(await endpointRequest(patientUser, review.id))
    expect(patientHistory.status).toBe(403)
    const anonymousHistory = await reviewPublicationHistoryGetHandler(await endpointRequest(null, review.id))
    expect(anonymousHistory.status).toBe(401)

    const platformWithoutReason = await reviewWithdrawPostHandler(await endpointRequest(platformUser, review.id, {}))
    expect(platformWithoutReason.status).toBe(400)
    const platformWithdrawal = await reviewWithdrawPostHandler(
      await endpointRequest(platformUser, review.id, { reason: 'Verified author request recorded by support.' }),
    )
    expect(platformWithdrawal.status).toBe(200)
    await expect(platformWithdrawal.json()).resolves.toMatchObject({
      data: { publicMeasure: 'redaction', withdrawalState: 'withdrawn', withdrawalSource: 'platform' },
    })
    expect((await readPublicReview(review.id)).docs).toHaveLength(0)

    await expect(
      payload.findVersions({
        collection: 'reviews',
        where: { parent: { equals: review.id } },
        user: ownClinicUser,
        overrideAccess: false,
        depth: 0,
        pagination: false,
      }),
    ).rejects.toThrow()

    const finalVersions = await payload.findVersions({
      collection: 'reviews',
      where: { parent: { equals: review.id } },
      overrideAccess: true,
      depth: 0,
      pagination: false,
    })
    expect(finalVersions.docs).toHaveLength(afterRepeated.docs.length + 2)
    expect(relationId(finalVersions.docs[0]?.parent)).toBe(review.id)

    await payload.update({
      collection: 'reviews',
      id: review.id,
      data: { authorVisibility: 'anonymous' },
      overrideAccess: true,
      depth: 0,
    })
    const anonymousAuthorHistoryResponse = await reviewPublicationHistoryGetHandler(
      await endpointRequest(ownClinicUser, review.id),
    )
    expect(anonymousAuthorHistoryResponse.status).toBe(200)
    const anonymousAuthorHistory = (await anonymousAuthorHistoryResponse.json()) as {
      data: { versions: Array<Record<string, unknown>> }
    }
    expect(anonymousAuthorHistory.data.versions.every((version) => version.publicAuthorName === null)).toBe(true)

    await payload.update({
      collection: 'reviews',
      id: review.id,
      data: { status: 'pending' },
      overrideAccess: true,
      depth: 0,
    })
    const pendingClinicHistory = await reviewPublicationHistoryGetHandler(
      await endpointRequest(ownClinicUser, review.id),
    )
    expect(pendingClinicHistory.status).toBe(404)
    const pendingPlatformHistory = await reviewPublicationHistoryGetHandler(
      await endpointRequest(platformUser, review.id),
    )
    expect(pendingPlatformHistory.status).toBe(200)
  }, 60000)
})
