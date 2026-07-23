import { expect } from '@playwright/test'

import { openAdminTab } from '../../adminUI'
import type { AdminJourneyDefinition, AdminJourneyStep } from '../types'
import { createCollectionCreateFragment, createJoinDrawerRelationFragment, defineJourneySteps } from '../fragments'
import {
  createAssertFieldValueStep,
  createAssertClinicApprovalValidationStep,
  createCaptureClinicTreatmentIdStep,
  createEnsureAssignedClinicStep,
  createEnsureIncompleteClinicStep,
  createFillClinicApprovalRequirementsStep,
  createFillClinicDraftStep,
  createFillClinicTreatmentStep,
  createOpenDocumentPageStep,
  createOpenTabStep,
  createSaveDocumentStep,
  createSelectClinicApprovedStep,
} from '../steps'

type RecordId = number | string

type ClinicDraftJourneyState = {
  clinicId?: string
  clinicName: string
}

type ClinicTreatmentJoinJourneyState = {
  clinicId?: RecordId
  clinicName: string
  clinicTreatmentId?: RecordId
  price: string
  treatmentId?: RecordId
  treatmentName: string
}

type ClinicApprovalJourneyState = {
  clinicId?: RecordId
  clinicName: string
}

const inspectSavedClinicApprovalRequirementsStep: AdminJourneyStep<ClinicApprovalJourneyState> = {
  checkpoint: {
    label: 'Clinic approval requirements complete',
    screenshotSlug: 'clinic-approval-requirements-complete',
  },
  collections: ['clinics'],
  kind: 'assertion',
  label: 'Verify the saved clinic has no stale approval errors',
  run: async ({ page }) => {
    await page.reload({ waitUntil: 'domcontentloaded' })
    await openAdminTab(page, 'Details & Status')
    await expect(page.getByText('All requirements are complete.')).toBeVisible()
    await expect(page.getByText('The following fields are invalid')).toHaveCount(0)
  },
  stepId: 'inspect-saved-approval-requirements',
}

export const clinicApprovalJourney: AdminJourneyDefinition<ClinicApprovalJourneyState> = {
  createState: () => ({
    clinicId: undefined,
    clinicName: '',
  }),
  description: 'Approve a pending clinic with visible conditional requirements and field validation.',
  journeyId: 'admin.clinics.approve-pending',
  metadata: {
    collections: ['clinics'],
    consumers: ['regression', 'capture'],
    entrypoints: ['document-page'],
    riskTags: ['clinic-approval', 'conditional-validation'],
  },
  persona: 'admin',
  steps: defineJourneySteps<ClinicApprovalJourneyState>([
    createEnsureIncompleteClinicStep({ stepId: 'ensure-incomplete-clinic' }),
    createOpenDocumentPageStep({
      collectionSlug: 'clinics',
      label: 'Open the pending clinic document',
      recordIdField: 'clinicId',
      stepId: 'open-pending-clinic',
    }),
    createOpenTabStep({
      label: 'Register clinic address fields for inline validation',
      stepId: 'open-clinic-address',
      tabLabel: 'Address',
    }),
    createOpenTabStep({
      label: 'Open clinic status details',
      stepId: 'open-clinic-status',
      tabLabel: 'Details & Status',
    }),
    createSelectClinicApprovedStep({
      stepId: 'select-approved-status',
      checkpoint: {
        label: 'Approval checklist with missing values',
        screenshotSlug: 'clinic-approval-requirements-missing',
      },
    }),
    createAssertClinicApprovalValidationStep({
      stepId: 'assert-approval-validation',
      checkpoint: {
        label: 'Clinic approval inline validation',
        screenshotSlug: 'clinic-approval-inline-validation',
      },
    }),
    createFillClinicApprovalRequirementsStep({
      stepId: 'fill-approval-requirements',
    }),
    createSaveDocumentStep({
      collectionSlug: 'clinics',
      label: 'Save the approved clinic',
      recordIdField: 'clinicId',
      stepId: 'save-approved-clinic',
    }),
    inspectSavedClinicApprovalRequirementsStep,
  ]),
}

export const clinicCreateDraftJourney: AdminJourneyDefinition<ClinicDraftJourneyState> = {
  createState: () => ({
    clinicId: undefined,
    clinicName: `E2E Clinic ${Date.now()}`,
  }),
  description: 'Create a draft clinic from the admin UI.',
  journeyId: 'admin.clinics.create-draft',
  metadata: {
    collections: ['clinics'],
    consumers: ['smoke', 'capture'],
    entrypoints: ['collection-create'],
    riskTags: ['clinic-create', 'admin-crud'],
  },
  persona: 'admin',
  steps: createCollectionCreateFragment<ClinicDraftJourneyState, 'clinicId'>({
    afterSave: [
      createAssertFieldValueStep({
        expectedValue: (state) => state.clinicName,
        fieldLabel: 'Name',
        label: 'Verify the clinic draft stays visible after save',
        stepId: 'assert-clinic-name',
      }),
    ],
    collectionSlug: 'clinics',
    fill: createFillClinicDraftStep({
      stepId: 'fill-clinic-form',
      checkpoint: {
        label: 'Clinic form filled',
        screenshotSlug: 'clinic-form-filled',
      },
    }),
    open: {
      label: 'Open the clinic create page',
      stepId: 'open-create-page',
      checkpoint: {
        label: 'Clinic create page',
        screenshotSlug: 'clinic-create-page',
      },
    },
    recordIdField: 'clinicId',
    save: {
      label: 'Save the clinic draft',
      stepId: 'save-clinic',
      checkpoint: {
        label: 'Clinic saved',
        screenshotSlug: 'clinic-saved',
      },
    },
  }),
}

export const clinicTreatmentJoinJourney: AdminJourneyDefinition<ClinicTreatmentJoinJourneyState> = {
  createState: () => ({
    clinicId: undefined,
    clinicName: '',
    clinicTreatmentId: undefined,
    price: '3500',
    treatmentId: undefined,
    treatmentName: '',
  }),
  description: 'Open the assigned clinic profile and add a treatment from the clinic join drawer.',
  journeyId: 'clinic.clinics.add-treatment-from-join',
  metadata: {
    collections: ['clinics', 'clinicStaff', 'clinictreatments', 'treatments'],
    consumers: ['regression', 'capture'],
    entrypoints: ['document-page', 'join-drawer'],
    riskTags: ['clinic-access', 'join-drawer', 'clinic-treatment'],
  },
  persona: 'clinic',
  steps: defineJourneySteps<ClinicTreatmentJoinJourneyState>(
    [
      createEnsureAssignedClinicStep({
        stepId: 'ensure-assigned-clinic-fixture',
      }),
    ],
    createJoinDrawerRelationFragment<ClinicTreatmentJoinJourneyState, 'clinicId'>({
      capture: createCaptureClinicTreatmentIdStep({
        label: 'Resolve the created clinic treatment id',
        stepId: 'capture-clinic-treatment-id',
      }),
      drawer: {
        fieldPath: 'treatments',
        label: 'Open the clinic treatment join drawer',
        stepId: 'open-clinic-treatment-join-drawer',
        checkpoint: {
          label: 'Clinic treatment join drawer opened',
          screenshotSlug: 'clinic-treatment-join-drawer-open',
        },
      },
      fill: createFillClinicTreatmentStep({
        stepId: 'fill-clinic-treatment-form',
        checkpoint: {
          label: 'Clinic treatment join drawer filled',
          screenshotSlug: 'clinic-treatment-join-drawer-filled',
        },
      }),
      openDocument: {
        collectionSlug: 'clinics',
        label: 'Open the assigned clinic document',
        recordIdField: 'clinicId',
        stepId: 'open-assigned-clinic-document',
        checkpoint: {
          label: 'Assigned clinic opened',
          screenshotSlug: 'clinic-treatment-clinic-opened',
        },
      },
      save: {
        label: 'Save the clinic treatment drawer',
        stepId: 'save-clinic-treatment-drawer',
        checkpoint: {
          label: 'Clinic treatment join drawer saved',
          screenshotSlug: 'clinic-treatment-join-drawer-saved',
        },
      },
      tab: {
        label: 'Open the general clinic tab',
        stepId: 'open-clinic-general-tab',
        tabLabel: 'General',
      },
    }),
  ),
}
