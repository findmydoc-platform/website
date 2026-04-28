import type { AdminJourneyDefinition } from '../types'
import { createCollectionCreateFragment, createJoinDrawerRelationFragment, defineJourneySteps } from '../fragments'
import {
  createAssertFieldValueStep,
  createCaptureClinicTreatmentIdStep,
  createEnsureAssignedClinicStep,
  createFillClinicDraftStep,
  createFillClinicTreatmentStep,
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
