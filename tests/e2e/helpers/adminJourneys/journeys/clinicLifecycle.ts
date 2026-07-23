import { expect } from '@playwright/test'
import { getPayload, type Payload } from 'payload'
import config from '@payload-config'

import { ensureApprovedClinicStaffAccess, ensureMedicalSpecialtyFixture } from '../../adminFixtures'
import { getRecordId, type CollectionListResponse, type CreatedDocResponse, type RecordId } from '../../adminApi'
import { getAdminFieldRoot, openAdminDocumentPage, selectComboboxOption } from '../../adminUI'
import { defineJourneySteps } from '../fragments'
import type { AdminJourneyDefinition, AdminJourneyStep } from '../types'

type ClinicStaffLifecycleJourneyState = {
  clinicStaffId?: RecordId
  ownsClinicStaffFixture: boolean
}

type ClinicApplicationLifecycleJourneyState = {
  applicationId?: RecordId
}

let clinicStaffFixturePayload: Payload | null = null

const getClinicStaffFixturePayload = async (): Promise<Payload> => {
  clinicStaffFixturePayload ??= await getPayload({ config, key: 'clinic-staff-lifecycle-journey' })
  return clinicStaffFixturePayload
}

const collectValidationPaths = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.flatMap(collectValidationPaths)
  if (!value || typeof value !== 'object') return []

  const record = value as Record<string, unknown>
  return [
    ...(typeof record.path === 'string' ? [record.path] : []),
    ...Object.values(record).flatMap(collectValidationPaths),
  ]
}

const ensureApprovedClinicStaffStep = {
  collections: ['clinicStaff'],
  kind: 'api-fixture',
  label: 'Ensure the fixed clinic staff account is approved',
  producesState: ['clinicStaffId'],
  run: async ({ request, state }) => {
    const fixedClinicEmail = process.env.E2E_CLINIC_EMAIL?.trim()

    if (fixedClinicEmail) {
      const fixture = await ensureApprovedClinicStaffAccess(request, {
        email: fixedClinicEmail,
      })
      state.clinicStaffId = fixture.clinicStaffId
      return
    }

    const fixtureResponse = await request.get(
      '/api/clinicStaff?depth=0&limit=1&where[status][equals]=approved&where[authSync.status][equals]=synced',
    )
    expect(fixtureResponse.ok()).toBeTruthy()
    const fixtureBody = (await fixtureResponse.json()) as CollectionListResponse
    state.clinicStaffId = getRecordId(fixtureBody.docs?.[0]?.id)
    if (state.clinicStaffId) return

    const payload = await getClinicStaffFixturePayload()
    const temporaryStaff = await payload.create({
      collection: 'clinicStaff',
      context: { skipClinicStaffAuthSync: true },
      data: {
        authSync: { errorCode: null, status: 'synced' },
        email: `clinic-lifecycle-${Date.now()}@example.com`,
        firstName: 'Lifecycle',
        lastName: 'Fixture',
        status: 'approved',
        supabaseUserId: `clinic-lifecycle-${Date.now()}`,
      },
      depth: 0,
      overrideAccess: true,
    })
    state.clinicStaffId = temporaryStaff.id
    state.ownsClinicStaffFixture = true
  },
  stepId: 'ensure-approved-clinic-staff',
} satisfies AdminJourneyStep<ClinicStaffLifecycleJourneyState>

const deleteTemporaryClinicStaffStep = {
  collections: ['clinicStaff'],
  kind: 'api-fixture',
  label: 'Delete the temporary clinic staff fixture',
  requiresState: ['clinicStaffId'],
  run: async ({ state }) => {
    if (!state.ownsClinicStaffFixture || state.clinicStaffId === undefined) return

    const payload = await getClinicStaffFixturePayload()

    try {
      await payload.delete({
        collection: 'clinicStaff',
        id: state.clinicStaffId,
        overrideAccess: true,
      })
    } finally {
      await payload.destroy()
      clinicStaffFixturePayload = null
    }
  },
  stepId: 'delete-temporary-clinic-staff',
} satisfies AdminJourneyStep<ClinicStaffLifecycleJourneyState>

const assertInvalidClinicStaffTransitionStep = {
  collections: ['clinicStaff'],
  kind: 'assertion',
  label: 'Verify the API rejects an invalid clinic staff transition',
  requiresState: ['clinicStaffId'],
  run: async ({ request, state }) => {
    const response = await request.patch(`/api/clinicStaff/${state.clinicStaffId}`, {
      data: { status: 'rejected' },
    })
    const responseBody = (await response.json()) as unknown

    expect(response.status()).toBe(400)
    expect(collectValidationPaths(responseBody)).toContain('status')

    const unchanged = await request.get(`/api/clinicStaff/${state.clinicStaffId}?depth=0`)
    expect(unchanged.ok()).toBeTruthy()
    await expect(unchanged.json()).resolves.toMatchObject({ status: 'approved' })
  },
  stepId: 'assert-invalid-transition-api',
} satisfies AdminJourneyStep<ClinicStaffLifecycleJourneyState>

const openClinicStaffLifecycleStep = {
  checkpoint: {
    label: 'Approved clinic staff lifecycle options',
    screenshotSlug: 'clinic-staff-approved-lifecycle',
  },
  collections: ['clinicStaff'],
  kind: 'navigation',
  label: 'Open the approved clinic staff document',
  requiresState: ['clinicStaffId'],
  run: async ({ page, state }) => {
    if (state.clinicStaffId === undefined) throw new Error('Clinic staff fixture is missing.')

    await openAdminDocumentPage(page, 'clinicStaff', state.clinicStaffId)
    await expect(page.getByRole('region', { name: 'Lifecycle impact' })).toBeVisible()
    await expect(page.getByText('Supabase access matches the saved clinic staff status.')).toBeVisible()
  },
  stepId: 'open-clinic-staff-lifecycle',
} satisfies AdminJourneyStep<ClinicStaffLifecycleJourneyState>

const inspectClinicStaffOptionsStep = {
  checkpoint: {
    label: 'Clinic staff disabled transition preview',
    screenshotSlug: 'clinic-staff-disabled-preview',
  },
  collections: ['clinicStaff'],
  kind: 'form-fill',
  label: 'Inspect allowed options and preview Disabled without saving',
  run: async ({ page }) => {
    const statusField = getAdminFieldRoot(page, 'status')
    const combobox = statusField.getByRole('combobox')
    await combobox.focus()
    await expect(combobox).toBeFocused()
    await page.keyboard.press('ArrowDown')

    await expect(page.getByRole('option', { name: 'Disabled' })).toBeVisible()
    await expect(page.getByRole('option', { name: 'Offboarded' })).toBeVisible()
    await expect(page.getByRole('option', { name: 'Pending' })).toHaveCount(0)
    await expect(page.getByRole('option', { name: 'Rejected' })).toHaveCount(0)
    await page.keyboard.press('Escape')

    await selectComboboxOption(page, 'Status', 'Disabled', { scope: statusField })
    const lifecyclePanel = page.getByRole('region', { name: 'Lifecycle impact' })
    await expect(page.getByText('Saving disables the Supabase identity.')).toBeVisible()
    await expect(page.getByText('Access removal selected')).toBeVisible()
    await expect(page.getByText('Something went wrong.')).toHaveCount(0)
    await lifecyclePanel.scrollIntoViewIfNeeded()
    expect(
      await lifecyclePanel.evaluate((element) => {
        const bounds = element.getBoundingClientRect()
        return element.scrollWidth <= element.clientWidth && bounds.left >= 0 && bounds.right <= window.innerWidth + 1
      }),
    ).toBe(true)
  },
  stepId: 'inspect-clinic-staff-options',
} satisfies AdminJourneyStep<ClinicStaffLifecycleJourneyState>

const createSubmittedClinicApplicationStep = {
  collections: ['clinicApplications', 'medical-specialties'],
  kind: 'api-fixture',
  label: 'Create a temporary submitted clinic application',
  producesState: ['applicationId'],
  run: async ({ request, state }) => {
    const specialty = await ensureMedicalSpecialtyFixture(request, { reuseExisting: true })
    const suffix = Date.now()
    const response = await request.post('/api/clinicApplications', {
      data: {
        clinicName: `E2E Lifecycle Clinic ${suffix}`,
        clinicWebsite: `https://lifecycle-${suffix}.example`,
        contactFirstName: 'Journey',
        contactLastName: 'Reviewer',
        contactEmail: `lifecycle-${suffix}@example.com`,
        contactRole: 'Clinic Management',
        medicalSpecialties: [specialty.specialtyId],
        status: 'submitted',
      },
    })
    expect(response.ok()).toBeTruthy()

    const body = (await response.json()) as CreatedDocResponse
    state.applicationId = getRecordId(body.doc?.id)
    expect(state.applicationId).toBeTruthy()
  },
  stepId: 'create-submitted-clinic-application',
} satisfies AdminJourneyStep<ClinicApplicationLifecycleJourneyState>

const openSubmittedClinicApplicationStep = {
  checkpoint: {
    label: 'Clinic application awaiting review',
    screenshotSlug: 'clinic-application-awaiting-review',
  },
  collections: ['clinicApplications'],
  kind: 'navigation',
  label: 'Open the submitted clinic application',
  requiresState: ['applicationId'],
  run: async ({ page, state }) => {
    if (state.applicationId === undefined) throw new Error('Clinic application fixture is missing.')

    await openAdminDocumentPage(page, 'clinicApplications', state.applicationId)
    await expect(page.getByRole('region', { name: 'Provisioning lifecycle' })).toBeVisible()
    await expect(page.getByText('Awaiting review', { exact: true })).toBeVisible()
  },
  stepId: 'open-submitted-clinic-application',
} satisfies AdminJourneyStep<ClinicApplicationLifecycleJourneyState>

const previewClinicApplicationApprovalStep = {
  checkpoint: {
    label: 'Clinic application Approved provisioning preview',
    screenshotSlug: 'clinic-application-approved-preview',
  },
  collections: ['clinicApplications'],
  kind: 'form-fill',
  label: 'Preview Approved without starting provisioning',
  run: async ({ page }) => {
    await selectComboboxOption(page, 'Status', 'Approved')
    const lifecyclePanel = page.getByRole('region', { name: 'Provisioning lifecycle' })
    await expect(page.getByText('Provisioning pending', { exact: true })).toBeVisible()
    await expect(page.getByText('Saving Approved starts automatic clinic and clinic staff creation.')).toBeVisible()
    await expect(page.getByText('Something went wrong.')).toHaveCount(0)
    expect(
      await lifecyclePanel.evaluate((element) => {
        const bounds = element.getBoundingClientRect()
        return element.scrollWidth <= element.clientWidth && bounds.left >= 0 && bounds.right <= window.innerWidth + 1
      }),
    ).toBe(true)
  },
  stepId: 'preview-clinic-application-approval',
} satisfies AdminJourneyStep<ClinicApplicationLifecycleJourneyState>

const deleteClinicApplicationStep = {
  collections: ['clinicApplications'],
  kind: 'api-fixture',
  label: 'Delete the temporary clinic application',
  requiresState: ['applicationId'],
  run: async ({ request, state }) => {
    const response = await request.delete(`/api/clinicApplications/${state.applicationId}`)
    expect(response.ok()).toBeTruthy()
  },
  stepId: 'delete-clinic-application',
} satisfies AdminJourneyStep<ClinicApplicationLifecycleJourneyState>

export const clinicStaffLifecycleJourney: AdminJourneyDefinition<ClinicStaffLifecycleJourneyState> = {
  createState: () => ({ clinicStaffId: undefined, ownsClinicStaffFixture: false }),
  description: 'Inspect valid clinic staff transitions, lifecycle impact, and structured API validation.',
  journeyId: 'admin.clinic-staff.lifecycle-guidance',
  metadata: {
    collections: ['clinicStaff'],
    consumers: ['regression', 'capture'],
    entrypoints: ['document-page'],
    riskTags: ['clinic-staff', 'lifecycle', 'supabase-sync'],
  },
  persona: 'admin',
  steps: defineJourneySteps<ClinicStaffLifecycleJourneyState>([
    ensureApprovedClinicStaffStep,
    assertInvalidClinicStaffTransitionStep,
    openClinicStaffLifecycleStep,
    inspectClinicStaffOptionsStep,
    deleteTemporaryClinicStaffStep,
  ]),
}

export const clinicApplicationLifecycleJourney: AdminJourneyDefinition<ClinicApplicationLifecycleJourneyState> = {
  createState: () => ({ applicationId: undefined }),
  description: 'Inspect clinic application review and automatic provisioning lifecycle guidance.',
  journeyId: 'admin.clinic-applications.provisioning-guidance',
  metadata: {
    collections: ['clinicApplications', 'medical-specialties'],
    consumers: ['regression', 'capture'],
    entrypoints: ['document-page'],
    riskTags: ['clinic-application', 'provisioning', 'lifecycle'],
  },
  persona: 'admin',
  steps: defineJourneySteps<ClinicApplicationLifecycleJourneyState>([
    createSubmittedClinicApplicationStep,
    openSubmittedClinicApplicationStep,
    previewClinicApplicationApprovalStep,
    deleteClinicApplicationStep,
  ]),
}
