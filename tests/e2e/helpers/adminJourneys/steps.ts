import { expect } from '@playwright/test'
import {
  ensureClinicFixture,
  ensureDoctorFixture,
  ensureIncompleteClinicFixture,
  ensureMedicalSpecialtyFixture,
  ensureTreatmentFixture,
  readAssignedClinicFixture,
} from '../adminFixtures'
import {
  getRecordId,
  readRequiredCollectionDocByFilters,
  readRequiredCollectionDocById,
  type RecordId,
} from '../adminApi'
import {
  fillAdminRichTextField,
  getAdminFieldRoot,
  openAdminCreatePage,
  openAdminDocumentPage,
  openAdminJoinCreateDrawer,
  openAdminTab,
  saveAdminDocumentForCollection,
  saveAdminDrawerDocument,
  selectComboboxOption,
  selectComboboxOptionIfVisible,
  selectFirstComboboxOption,
  selectFirstComboboxOptionIfVisible,
} from '../adminUI'
import type { AdminJourneyStep } from './types'

const toFieldValue = (value: number | string) => String(value)

export const createOpenCreatePageStep = <TState extends Record<string, unknown>>(options: {
  checkpoint?: AdminJourneyStep<TState>['checkpoint']
  collectionSlug: string
  label: string
  stepId: string
}) =>
  ({
    collections: [options.collectionSlug],
    checkpoint: options.checkpoint,
    kind: 'navigation',
    label: options.label,
    run: async ({ page }) => {
      await openAdminCreatePage(page, options.collectionSlug)
    },
    stepId: options.stepId,
  }) satisfies AdminJourneyStep<TState>

export const createOpenDocumentPageStep = <
  TState extends Record<string, unknown>,
  TKey extends keyof TState & string,
>(options: {
  checkpoint?: AdminJourneyStep<TState>['checkpoint']
  collectionSlug: string
  label: string
  recordIdField: TKey
  stepId: string
}) =>
  ({
    collections: [options.collectionSlug],
    checkpoint: options.checkpoint,
    kind: 'navigation',
    label: options.label,
    requiresState: [options.recordIdField],
    run: async ({ page, state }) => {
      const recordId = state[options.recordIdField]
      if (typeof recordId !== 'string' && typeof recordId !== 'number') {
        throw new Error(`Journey step ${options.stepId} requires ${options.recordIdField} to be set.`)
      }

      await openAdminDocumentPage(page, options.collectionSlug, recordId)
    },
    stepId: options.stepId,
  }) satisfies AdminJourneyStep<TState>

export const createOpenTabStep = <TState extends Record<string, unknown>>(options: {
  checkpoint?: AdminJourneyStep<TState>['checkpoint']
  label: string
  stepId: string
  tabLabel: string
}) =>
  ({
    checkpoint: options.checkpoint,
    kind: 'navigation',
    label: options.label,
    run: async ({ page }) => {
      await openAdminTab(page, options.tabLabel)
    },
    stepId: options.stepId,
  }) satisfies AdminJourneyStep<TState>

export const createOpenJoinCreateDrawerStep = <TState extends Record<string, unknown>>(options: {
  checkpoint?: AdminJourneyStep<TState>['checkpoint']
  fieldPath: string
  label: string
  stepId: string
}) =>
  ({
    checkpoint: options.checkpoint,
    kind: 'navigation',
    label: options.label,
    run: async ({ page }) => {
      await openAdminJoinCreateDrawer(page, options.fieldPath)
    },
    stepId: options.stepId,
  }) satisfies AdminJourneyStep<TState>

export const createFillClinicDraftStep = <TState extends { clinicName: string }>(options: {
  checkpoint?: AdminJourneyStep<TState>['checkpoint']
  stepId: string
}) =>
  ({
    checkpoint: options.checkpoint,
    kind: 'form-fill',
    label: 'Fill clinic draft fields',
    producesState: ['clinicName'],
    run: async ({ page, state }) => {
      const clinicName = state.clinicName || `E2E Clinic ${Date.now()}`
      state.clinicName = clinicName

      await page.getByLabel('Name').fill(clinicName)

      await openAdminTab(page, 'Address')
      await page.getByLabel('Street').fill('Smoke Street')
      await page.getByLabel('House Number').fill('12A')
      await page.getByLabel('Zip Code').fill('34000')
      await selectComboboxOption(page, 'City', 'Istanbul')

      await openAdminTab(page, 'Contact')
      await page.getByLabel('Phone Number').fill('+90 555 0000000')
      await getAdminFieldRoot(page, 'contact.email').getByLabel('Email').fill(`admin-e2e+${Date.now()}@example.com`)

      await openAdminTab(page, 'Details & Status')
      await selectComboboxOption(page, 'Supported Languages', 'English')
    },
    stepId: options.stepId,
  }) satisfies AdminJourneyStep<TState>

export const createEnsureIncompleteClinicStep = <
  TState extends {
    clinicId?: RecordId
    clinicName: string
  },
>(options: {
  stepId: string
}) =>
  ({
    collections: ['clinics'],
    kind: 'api-fixture',
    label: 'Provision an incomplete pending clinic through the API',
    producesState: ['clinicId', 'clinicName'],
    run: async ({ request, state }) => {
      const clinic = await ensureIncompleteClinicFixture(request)
      state.clinicId = clinic.clinicId
      state.clinicName = clinic.clinicName
    },
    stepId: options.stepId,
  }) satisfies AdminJourneyStep<TState>

export const createSelectClinicApprovedStep = <TState extends Record<string, unknown>>(options: {
  checkpoint?: AdminJourneyStep<TState>['checkpoint']
  stepId: string
}) =>
  ({
    checkpoint: options.checkpoint,
    kind: 'form-fill',
    label: 'Select the approved clinic status',
    run: async ({ page }) => {
      await selectComboboxOption(page, 'Status', 'Approved')
      await expect(page.getByText('10 requirements are incomplete.')).toBeVisible()
    },
    stepId: options.stepId,
  }) satisfies AdminJourneyStep<TState>

export const createAssertClinicApprovalValidationStep = <TState extends Record<string, unknown>>(options: {
  checkpoint?: AdminJourneyStep<TState>['checkpoint']
  stepId: string
}) =>
  ({
    checkpoint: options.checkpoint,
    kind: 'assertion',
    label: 'Verify field-level clinic approval validation',
    run: async ({ page }) => {
      const saveButton = page.getByRole('button', { name: /^Save$/ })
      const validationResponse = page.waitForResponse(
        (response) =>
          response.request().method() === 'PATCH' &&
          response.url().includes('/api/clinics/') &&
          response.status() === 400,
      )
      await saveButton.click()
      await validationResponse
      await openAdminTab(page, 'Address')
      const countryError = page.getByText('Country is required before this clinic can be approved.')
      await expect(countryError).toBeVisible()
      await expect(page.getByText('Something went wrong.')).toHaveCount(0)
    },
    stepId: options.stepId,
  }) satisfies AdminJourneyStep<TState>

export const createFillClinicApprovalRequirementsStep = <TState extends Record<string, unknown>>(options: {
  checkpoint?: AdminJourneyStep<TState>['checkpoint']
  stepId: string
}) =>
  ({
    checkpoint: options.checkpoint,
    kind: 'form-fill',
    label: 'Fill every clinic approval requirement',
    run: async ({ page }) => {
      await page.getByLabel('Country').fill('Turkey')
      await page.getByLabel('Street').fill('Approval Street')
      await page.getByLabel('House Number').fill('12A')
      await page.getByLabel('Zip Code').fill('34000')
      await selectComboboxOption(page, 'City', 'Istanbul')

      await openAdminTab(page, 'Contact')
      await getAdminFieldRoot(page, 'internalPrimaryContact.firstName').getByLabel('First Name').fill('Journey')
      await getAdminFieldRoot(page, 'internalPrimaryContact.lastName').getByLabel('Last Name').fill('Coordinator')
      await getAdminFieldRoot(page, 'internalPrimaryContact.email')
        .getByLabel('Email')
        .fill(`journey-approval-${Date.now()}@example.com`)
      await selectComboboxOption(page, 'Role', 'Clinic Management', {
        scope: getAdminFieldRoot(page, 'internalPrimaryContact.role'),
      })

      await openAdminTab(page, 'Details & Status')
      await selectComboboxOption(page, 'Supported Languages', 'English', {
        scope: getAdminFieldRoot(page, 'supportedLanguages'),
      })
      await expect(page.getByText('All requirements are complete.')).toBeVisible()
    },
    stepId: options.stepId,
  }) satisfies AdminJourneyStep<TState>

export const createEnsureReviewContextStep = <
  TState extends {
    clinicId?: RecordId
    clinicName: string
    doctorId?: RecordId
    doctorName: string
    treatmentId?: RecordId
    treatmentName: string
  },
>(options: {
  stepId: string
}) =>
  ({
    collections: ['clinics', 'doctors', 'treatments'],
    kind: 'api-fixture',
    label: 'Provision review context fixtures through the API',
    producesState: ['clinicId', 'clinicName', 'doctorId', 'doctorName', 'treatmentId', 'treatmentName'],
    run: async ({ request, state }) => {
      const clinic = await ensureClinicFixture(request, { reuseExisting: true })
      const doctor = await ensureDoctorFixture(request, { clinicId: clinic.clinicId })
      const treatment = await ensureTreatmentFixture(request, { reuseExisting: true })

      state.clinicId = clinic.clinicId
      state.clinicName = clinic.clinicName
      state.doctorId = doctor.doctorId
      state.doctorName = doctor.doctorFullName
      state.treatmentId = treatment.treatmentId
      state.treatmentName = treatment.treatmentName
    },
    stepId: options.stepId,
  }) satisfies AdminJourneyStep<TState>

export const createFillReviewWithoutPatientStep = <
  TState extends {
    clinicName: string
    doctorName: string
    treatmentName: string
  },
>(options: {
  checkpoint?: AdminJourneyStep<TState>['checkpoint']
  stepId: string
}) =>
  ({
    checkpoint: options.checkpoint,
    kind: 'form-fill',
    label: 'Fill review fields without a patient',
    run: async ({ page, state }) => {
      await page.getByLabel('Star Rating').fill('4')
      await page.getByLabel('Comment').fill('Review validation journey')
      await page
        .getByText('Review Context', { exact: true })
        .locator('xpath=ancestor::*[contains(concat(" ", normalize-space(@class), " "), " collapsible-field ")][1]')
        .locator('button.collapsible__toggle')
        .click()
      await selectComboboxOption(page, 'Clinic', state.clinicName)
      await selectComboboxOption(page, 'Doctor', state.doctorName)
      await selectComboboxOption(page, 'Treatment', state.treatmentName)
    },
    stepId: options.stepId,
  }) satisfies AdminJourneyStep<TState>

export const createAssertReviewPatientValidationStep = <TState extends Record<string, unknown>>(options: {
  checkpoint?: AdminJourneyStep<TState>['checkpoint']
  stepId: string
}) =>
  ({
    checkpoint: options.checkpoint,
    kind: 'assertion',
    label: 'Verify patient validation on review creation',
    run: async ({ page }) => {
      const saveButton = page.getByRole('button', { name: /^Save$/ })
      await saveButton.click()
      const patientError = page.getByText('Patient is required when creating a review.')
      await patientError.scrollIntoViewIfNeeded()
      await expect(patientError).toBeVisible()
      await expect(page.getByText('Something went wrong.')).toHaveCount(0)
    },
    stepId: options.stepId,
  }) satisfies AdminJourneyStep<TState>

export const createSaveDocumentStep = <
  TState extends Record<string, unknown>,
  TKey extends keyof TState & string,
>(options: {
  checkpoint?: AdminJourneyStep<TState>['checkpoint']
  collectionSlug: string
  label: string
  recordIdField: TKey
  stepId: string
}) =>
  ({
    collections: [options.collectionSlug],
    checkpoint: options.checkpoint,
    kind: 'save',
    label: options.label,
    producesState: [options.recordIdField],
    run: async ({ page, state }) => {
      const recordId = await saveAdminDocumentForCollection(page, options.collectionSlug)
      if (recordId) {
        state[options.recordIdField] = recordId as TState[TKey]
      }
    },
    stepId: options.stepId,
  }) satisfies AdminJourneyStep<TState>

export const createSaveDrawerDocumentStep = <TState extends Record<string, unknown>>(options: {
  checkpoint?: AdminJourneyStep<TState>['checkpoint']
  label: string
  stepId: string
}) =>
  ({
    checkpoint: options.checkpoint,
    kind: 'save',
    label: options.label,
    run: async ({ page }) => {
      await saveAdminDrawerDocument(page)
    },
    stepId: options.stepId,
  }) satisfies AdminJourneyStep<TState>

export const createAssertFieldValueStep = <TState extends Record<string, unknown>>(options: {
  checkpoint?: AdminJourneyStep<TState>['checkpoint']
  expectedValue: (state: TState) => number | string
  fieldLabel: string
  label: string
  stepId: string
}) =>
  ({
    checkpoint: options.checkpoint,
    kind: 'assertion',
    label: options.label,
    run: async ({ page, state }) => {
      await expect(page.getByLabel(options.fieldLabel)).toHaveValue(toFieldValue(options.expectedValue(state)))
    },
    stepId: options.stepId,
  }) satisfies AdminJourneyStep<TState>

export const createFillMedicalSpecialtyStep = <TState extends { specialtyName: string }>(options: {
  checkpoint?: AdminJourneyStep<TState>['checkpoint']
  stepId: string
}) =>
  ({
    checkpoint: options.checkpoint,
    kind: 'form-fill',
    label: 'Fill medical specialty form',
    producesState: ['specialtyName'],
    run: async ({ page, state }) => {
      const specialtyName = state.specialtyName || `E2E Specialty ${Date.now()}`
      state.specialtyName = specialtyName

      await expect(page.getByText('Use this collection for specialty taxonomy only.')).toBeVisible()
      await expect(page.getByRole('link', { name: 'See seeding documentation' })).toBeVisible()

      await page.getByLabel('Name').fill(specialtyName)
      await page.getByLabel('Description').fill('Created during Playwright admin journey')
    },
    stepId: options.stepId,
  }) satisfies AdminJourneyStep<TState>

export const createEnsureClinicFixtureStep = <
  TState extends {
    clinicId?: RecordId
    clinicName: string
  },
>(options: {
  checkpoint?: AdminJourneyStep<TState>['checkpoint']
  reuseExisting?: boolean
  stepId: string
}) =>
  ({
    collections: ['clinics'],
    checkpoint: options.checkpoint,
    kind: 'api-fixture',
    label: 'Provision clinic fixture through the API',
    producesState: ['clinicId', 'clinicName'],
    run: async ({ request, state }) => {
      if (state.clinicId && state.clinicName) {
        return
      }

      if (state.clinicId) {
        const clinicDoc = await readRequiredCollectionDocById(request, 'clinics', state.clinicId)
        state.clinicName = String(clinicDoc.name ?? state.clinicId)
        return
      }

      const clinicFixture = await ensureClinicFixture(request, {
        reuseExisting: options.reuseExisting ?? true,
      })

      state.clinicId = clinicFixture.clinicId
      state.clinicName = clinicFixture.clinicName
    },
    stepId: options.stepId,
  }) satisfies AdminJourneyStep<TState>

export const createEnsureAssignedClinicStep = <
  TState extends {
    clinicId?: RecordId
    clinicName: string
  },
>(options: {
  checkpoint?: AdminJourneyStep<TState>['checkpoint']
  stepId: string
}) =>
  ({
    collections: ['clinics', 'clinicStaff'],
    checkpoint: options.checkpoint,
    kind: 'api-fixture',
    label: 'Resolve the assigned clinic through the authenticated clinic session',
    producesState: ['clinicId', 'clinicName'],
    run: async ({ request, state }) => {
      if (state.clinicId && state.clinicName) {
        return
      }

      if (state.clinicId) {
        const clinicDoc = await readRequiredCollectionDocById(request, 'clinics', state.clinicId)
        state.clinicName = String(clinicDoc.name ?? state.clinicId)
        return
      }

      const clinicFixture = await readAssignedClinicFixture(request)

      state.clinicId = clinicFixture.clinicId
      state.clinicName = clinicFixture.clinicName
    },
    stepId: options.stepId,
  }) satisfies AdminJourneyStep<TState>

export const createEnsureDoctorFixtureStep = <
  TState extends {
    clinicId?: RecordId
    doctorFullName: string
    doctorId?: RecordId
  },
>(options: {
  checkpoint?: AdminJourneyStep<TState>['checkpoint']
  stepId: string
}) =>
  ({
    collections: ['doctors'],
    checkpoint: options.checkpoint,
    kind: 'api-fixture',
    label: 'Provision doctor fixture through the API',
    producesState: ['doctorId', 'doctorFullName'],
    run: async ({ request, state }) => {
      if (state.doctorId && state.doctorFullName) {
        return
      }

      if (state.doctorId) {
        const doctorDoc = await readRequiredCollectionDocById(request, 'doctors', state.doctorId)
        const doctorFullName =
          typeof doctorDoc.fullName === 'string'
            ? doctorDoc.fullName
            : `${String(doctorDoc.firstName ?? '')} ${String(doctorDoc.lastName ?? '')}`.trim()

        state.doctorFullName = doctorFullName
        return
      }

      const doctorFixture = await ensureDoctorFixture(request, {
        clinicId: state.clinicId,
      })

      state.doctorId = doctorFixture.doctorId
      state.doctorFullName = doctorFixture.doctorFullName
    },
    stepId: options.stepId,
  }) satisfies AdminJourneyStep<TState>

export const createEnsureMedicalSpecialtyFixtureStep = <
  TState extends {
    specialtyId?: RecordId
    specialtyName: string
  },
>(options: {
  checkpoint?: AdminJourneyStep<TState>['checkpoint']
  reuseExisting?: boolean
  stepId: string
}) =>
  ({
    collections: ['medical-specialties'],
    checkpoint: options.checkpoint,
    kind: 'api-fixture',
    label: 'Provision medical specialty fixture through the API',
    producesState: ['specialtyId', 'specialtyName'],
    run: async ({ request, state }) => {
      if (state.specialtyId && state.specialtyName) {
        return
      }

      const specialtyFixture = await ensureMedicalSpecialtyFixture(request, {
        reuseExisting: state.specialtyId === undefined ? (options.reuseExisting ?? true) : false,
        specialtyId: state.specialtyId,
      })

      state.specialtyId = specialtyFixture.specialtyId
      state.specialtyName = specialtyFixture.specialtyName
    },
    stepId: options.stepId,
  }) satisfies AdminJourneyStep<TState>

export const createEnsureTreatmentFixtureStep = <
  TState extends {
    specialtyId?: RecordId
    treatmentId?: RecordId
    treatmentName: string
  },
>(options: {
  checkpoint?: AdminJourneyStep<TState>['checkpoint']
  reuseExisting?: boolean
  stepId: string
}) =>
  ({
    collections: ['treatments', 'medical-specialties'],
    checkpoint: options.checkpoint,
    kind: 'api-fixture',
    label: 'Provision treatment fixture through the API',
    producesState: ['specialtyId', 'treatmentId', 'treatmentName'],
    run: async ({ request, state }) => {
      if (state.treatmentId && state.treatmentName) {
        return
      }

      if (state.treatmentId) {
        const treatmentDoc = await readRequiredCollectionDocById(request, 'treatments', state.treatmentId)
        state.specialtyId = getRecordId(treatmentDoc.medicalSpecialty) ?? state.specialtyId
        state.treatmentName = String(treatmentDoc.name ?? state.treatmentId)
        return
      }

      const treatmentFixture = await ensureTreatmentFixture(request, {
        medicalSpecialtyId: state.specialtyId,
        reuseExisting: state.treatmentId === undefined ? (options.reuseExisting ?? true) : false,
      })

      state.specialtyId = treatmentFixture.medicalSpecialtyId
      state.treatmentId = treatmentFixture.treatmentId
      state.treatmentName = treatmentFixture.treatmentName
    },
    stepId: options.stepId,
  }) satisfies AdminJourneyStep<TState>

export const createFillDoctorSpecialtyRelationStep = <
  TState extends {
    doctorFullName: string
    specialtyName: string
  },
>(options: {
  checkpoint?: AdminJourneyStep<TState>['checkpoint']
  stepId: string
}) =>
  ({
    checkpoint: options.checkpoint,
    kind: 'form-fill',
    label: 'Fill doctor specialty relation form',
    requiresState: ['doctorFullName'],
    run: async ({ page, state }) => {
      await selectComboboxOption(page, 'Doctor', state.doctorFullName)

      if (state.specialtyName) {
        await selectComboboxOption(page, 'Medical Specialty', state.specialtyName)
      } else {
        const selectedName = await selectFirstComboboxOption(page, 'Medical Specialty')
        if (!selectedName) {
          throw new Error('No medical specialty is available to link in the admin UI.')
        }

        state.specialtyName = selectedName
      }

      await selectComboboxOption(page, 'Specialization Level', 'Specialist')
    },
    stepId: options.stepId,
  }) satisfies AdminJourneyStep<TState>

export const createFillTreatmentStep = <
  TState extends {
    specialtyName: string
    treatmentName: string
  },
>(options: {
  checkpoint?: AdminJourneyStep<TState>['checkpoint']
  stepId: string
}) =>
  ({
    checkpoint: options.checkpoint,
    kind: 'form-fill',
    label: 'Fill treatment form',
    producesState: ['specialtyName', 'treatmentName'],
    run: async ({ page, state }) => {
      const treatmentName = state.treatmentName || `E2E Treatment ${Date.now()}`
      state.treatmentName = treatmentName

      await page.getByLabel('Name').fill(treatmentName)
      await fillAdminRichTextField(page, 'Description', `${treatmentName} created during Playwright admin journey`, {
        fieldPath: 'description',
      })

      if (state.specialtyName) {
        await selectComboboxOption(page, 'Medical Specialty', state.specialtyName)
      } else {
        const selectedName = await selectFirstComboboxOption(page, 'Medical Specialty')
        if (!selectedName) {
          throw new Error('No medical specialty is available to assign to the treatment in the admin UI.')
        }

        state.specialtyName = selectedName
      }
    },
    stepId: options.stepId,
  }) satisfies AdminJourneyStep<TState>

export const createFillClinicTreatmentStep = <
  TState extends {
    clinicName: string
    price: string
    treatmentName: string
  },
>(options: {
  checkpoint?: AdminJourneyStep<TState>['checkpoint']
  stepId: string
}) =>
  ({
    checkpoint: options.checkpoint,
    kind: 'form-fill',
    label: 'Fill clinic treatment relation form',
    producesState: ['price'],
    run: async ({ page, state }) => {
      const price = state.price || '3500'
      state.price = price

      await getAdminFieldRoot(page, 'price').getByRole('spinbutton').fill(price)

      if (state.clinicName) {
        await selectComboboxOptionIfVisible(page, 'Clinic', state.clinicName)
      } else {
        const selectedClinicName = await selectFirstComboboxOptionIfVisible(page, 'Clinic')
        if (selectedClinicName) {
          state.clinicName = selectedClinicName
        }
      }

      if (state.treatmentName) {
        await selectComboboxOptionIfVisible(page, 'Treatment', state.treatmentName)
      } else {
        const selectedTreatmentName = await selectFirstComboboxOptionIfVisible(page, 'Treatment')
        if (selectedTreatmentName) {
          state.treatmentName = selectedTreatmentName
        }
      }
    },
    stepId: options.stepId,
  }) satisfies AdminJourneyStep<TState>

export const createCaptureClinicTreatmentIdStep = <
  TState extends {
    clinicId?: RecordId
    clinicTreatmentId?: RecordId
    treatmentId?: RecordId
  },
>(options: {
  checkpoint?: AdminJourneyStep<TState>['checkpoint']
  label: string
  stepId: string
}) =>
  ({
    collections: ['clinictreatments'],
    checkpoint: options.checkpoint,
    kind: 'capture',
    label: options.label,
    producesState: ['clinicTreatmentId'],
    run: async ({ request, state }) => {
      const filters: Record<string, RecordId> = {}

      if (state.clinicId !== undefined) {
        filters.clinic = state.clinicId
      }

      if (state.treatmentId !== undefined) {
        filters.treatment = state.treatmentId
      }

      if (Object.keys(filters).length === 0) {
        throw new Error(
          `Journey step ${options.stepId} requires clinicId or treatmentId to locate the clinic treatment.`,
        )
      }

      const clinicTreatmentDoc = await readRequiredCollectionDocByFilters(request, 'clinictreatments', filters)
      const clinicTreatmentId = getRecordId(clinicTreatmentDoc.id)
      expect(clinicTreatmentId).toBeTruthy()

      state.clinicTreatmentId = clinicTreatmentId as TState['clinicTreatmentId']
    },
    stepId: options.stepId,
  }) satisfies AdminJourneyStep<TState>

export const createFillDoctorTreatmentStep = <
  TState extends {
    doctorFullName: string
    specializationLevel?: string
    treatmentName: string
  },
>(options: {
  checkpoint?: AdminJourneyStep<TState>['checkpoint']
  stepId: string
}) =>
  ({
    checkpoint: options.checkpoint,
    kind: 'form-fill',
    label: 'Fill doctor treatment relation form',
    producesState: ['specializationLevel'],
    run: async ({ page, state }) => {
      const specializationLevel = state.specializationLevel || 'Specialist'
      state.specializationLevel = specializationLevel

      if (state.doctorFullName) {
        await selectComboboxOptionIfVisible(page, 'Doctor', state.doctorFullName)
      }

      if (state.treatmentName) {
        await selectComboboxOptionIfVisible(page, 'Treatment', state.treatmentName)
      } else {
        const selectedTreatmentName = await selectFirstComboboxOptionIfVisible(page, 'Treatment')
        if (selectedTreatmentName) {
          state.treatmentName = selectedTreatmentName
        }
      }

      await selectComboboxOption(page, 'Specialization Level', specializationLevel)
    },
    stepId: options.stepId,
  }) satisfies AdminJourneyStep<TState>

export const createCaptureDoctorTreatmentIdStep = <
  TState extends {
    doctorId?: RecordId
    doctorTreatmentId?: RecordId
    treatmentId?: RecordId
  },
>(options: {
  checkpoint?: AdminJourneyStep<TState>['checkpoint']
  label: string
  stepId: string
}) =>
  ({
    collections: ['doctortreatments'],
    checkpoint: options.checkpoint,
    kind: 'capture',
    label: options.label,
    producesState: ['doctorTreatmentId'],
    run: async ({ request, state }) => {
      const filters: Record<string, RecordId> = {}

      if (state.doctorId !== undefined) {
        filters.doctor = state.doctorId
      }

      if (state.treatmentId !== undefined) {
        filters.treatment = state.treatmentId
      }

      if (Object.keys(filters).length === 0) {
        throw new Error(
          `Journey step ${options.stepId} requires doctorId or treatmentId to locate the doctor treatment.`,
        )
      }

      const doctorTreatmentDoc = await readRequiredCollectionDocByFilters(request, 'doctortreatments', filters)
      const doctorTreatmentId = getRecordId(doctorTreatmentDoc.id)
      expect(doctorTreatmentId).toBeTruthy()

      state.doctorTreatmentId = doctorTreatmentId as TState['doctorTreatmentId']
    },
    stepId: options.stepId,
  }) satisfies AdminJourneyStep<TState>

export const createFillTagStep = <TState extends { tagName: string }>(options: {
  checkpoint?: AdminJourneyStep<TState>['checkpoint']
  stepId: string
}) =>
  ({
    checkpoint: options.checkpoint,
    kind: 'form-fill',
    label: 'Fill tag form',
    producesState: ['tagName'],
    run: async ({ page, state }) => {
      const tagName = state.tagName || `e2e-tag-${Date.now()}`
      state.tagName = tagName
      await page.getByLabel('Name').fill(tagName)
    },
    stepId: options.stepId,
  }) satisfies AdminJourneyStep<TState>

export const createFillDoctorProfileStep = <TState extends { doctorFullName: string }>(options: {
  checkpoint?: AdminJourneyStep<TState>['checkpoint']
  stepId: string
}) =>
  ({
    checkpoint: options.checkpoint,
    kind: 'form-fill',
    label: 'Fill doctor profile form',
    producesState: ['doctorFullName'],
    run: async ({ page, state }) => {
      const suffix = Date.now()
      const firstName = `E2E Clinic Doctor ${suffix}`
      const lastName = 'Journey'

      state.doctorFullName = `${firstName} ${lastName}`

      await page.getByLabel('First Name').fill(firstName)
      await page.getByLabel('Last Name').fill(lastName)
      await selectComboboxOption(page, 'Gender', 'Male')

      await openAdminTab(page, 'Qualifications & Clinic')
      await page.getByLabel('Qualifications').locator('input').first().fill('Clinic E2E Qualification')
      await selectComboboxOption(page, 'Languages', 'English')
    },
    stepId: options.stepId,
  }) satisfies AdminJourneyStep<TState>
