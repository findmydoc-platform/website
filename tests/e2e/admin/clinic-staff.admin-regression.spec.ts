import { expect, test } from '@playwright/test'
import {
  createSessionBoundRequestContext,
  ensureApprovedClinicStaffAccess,
  ensureMedicalSpecialtyFixture,
  ensureTreatmentFixture,
} from '../helpers/adminFixtures'
import { getAdminJourneyDefinition, executeAdminJourney } from '../helpers/adminJourneys'
import { readClinicCredentialsFromEnv } from '../helpers/adminSession'
import { createBrowserIssueCollector, expectNoBrowserIssues } from '../helpers/adminUI'
import { E2E_ADMIN_SESSION_FILE } from '../helpers/paths'

test.describe.configure({ mode: 'serial' })

test('clinic staff can create a doctor and link the doctor to a specialty @regression', async ({ page }) => {
  const issues = createBrowserIssueCollector(page, {
    ignoredConsoleErrors: [/TypeError: Failed to fetch/, /TypeError: network error/],
  })
  const adminRequest = await createSessionBoundRequestContext(E2E_ADMIN_SESSION_FILE)

  try {
    const specialtyFixture = await ensureMedicalSpecialtyFixture(adminRequest, {
      reuseExisting: true,
    })

    const result = await executeAdminJourney(getAdminJourneyDefinition('clinic.doctors.create-and-link-specialty'), {
      initialState: {
        specialtyName: specialtyFixture.specialtyName,
      },
      mode: 'regression',
      page,
      persona: 'clinic',
      request: page.request,
    })

    await expect(result.state.doctorFullName).toBeTruthy()
    await expect(result.state.doctorSpecialtyId).toBeTruthy()
    await expectNoBrowserIssues(issues)
  } finally {
    await adminRequest.dispose()
  }
})

test('clinic staff can add a treatment from the assigned clinic profile @regression', async ({ page }) => {
  const issues = createBrowserIssueCollector(page, {
    ignoredConsoleErrors: [/TypeError: Failed to fetch/, /TypeError: network error/],
  })
  const adminRequest = await createSessionBoundRequestContext(E2E_ADMIN_SESSION_FILE)
  const clinicCredentials = readClinicCredentialsFromEnv()

  try {
    const clinicAccess = await ensureApprovedClinicStaffAccess(adminRequest, {
      email: clinicCredentials.email,
    })
    const specialtyFixture = await ensureMedicalSpecialtyFixture(adminRequest, {
      reuseExisting: true,
    })
    const treatmentFixture = await ensureTreatmentFixture(adminRequest, {
      medicalSpecialtyId: specialtyFixture.specialtyId,
      reuseExisting: false,
    })

    const result = await executeAdminJourney(getAdminJourneyDefinition('clinic.clinics.add-treatment-from-join'), {
      initialState: {
        clinicId: clinicAccess.clinicId,
        treatmentId: treatmentFixture.treatmentId,
        treatmentName: treatmentFixture.treatmentName,
      },
      mode: 'regression',
      page,
      persona: 'clinic',
      request: page.request,
    })

    await expect(result.state.clinicTreatmentId).toBeTruthy()
    await expectNoBrowserIssues(issues)
  } finally {
    await adminRequest.dispose()
  }
})

test('clinic staff can create a doctor and link the doctor to a treatment @regression', async ({ page }) => {
  const issues = createBrowserIssueCollector(page, {
    ignoredConsoleErrors: [/TypeError: Failed to fetch/, /TypeError: network error/],
  })
  const adminRequest = await createSessionBoundRequestContext(E2E_ADMIN_SESSION_FILE)

  try {
    const specialtyFixture = await ensureMedicalSpecialtyFixture(adminRequest, {
      reuseExisting: true,
    })
    const treatmentFixture = await ensureTreatmentFixture(adminRequest, {
      medicalSpecialtyId: specialtyFixture.specialtyId,
      reuseExisting: false,
    })

    const result = await executeAdminJourney(getAdminJourneyDefinition('clinic.doctors.create-and-link-treatment'), {
      initialState: {
        treatmentId: treatmentFixture.treatmentId,
        treatmentName: treatmentFixture.treatmentName,
      },
      mode: 'regression',
      page,
      persona: 'clinic',
      request: page.request,
    })

    await expect(result.state.doctorId).toBeTruthy()
    await expect(result.state.doctorTreatmentId).toBeTruthy()
    await expectNoBrowserIssues(issues)
  } finally {
    await adminRequest.dispose()
  }
})
