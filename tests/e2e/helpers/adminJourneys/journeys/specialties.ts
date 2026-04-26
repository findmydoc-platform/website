import type { AdminJourneyDefinition } from '../types'
import { createCollectionCreateFragment, defineJourneySteps } from '../fragments'
import {
  createAssertFieldValueStep,
  createEnsureDoctorFixtureStep,
  createEnsureMedicalSpecialtyFixtureStep,
  createFillDoctorProfileStep,
  createFillDoctorSpecialtyRelationStep,
  createFillMedicalSpecialtyStep,
} from '../steps'

type RecordId = number | string

type MedicalSpecialtyJourneyState = {
  specialtyId?: RecordId
  specialtyName: string
}

type DoctorSpecialtyJourneyState = {
  clinicId?: RecordId
  doctorFullName: string
  doctorId?: RecordId
  doctorSpecialtyId?: string
  specialtyId?: RecordId
  specialtyName: string
}

type ClinicDoctorSpecialtyJourneyState = {
  doctorFullName: string
  doctorId?: string
  doctorSpecialtyId?: string
  specialtyId?: RecordId
  specialtyName: string
}

export const medicalSpecialtyCreateJourney: AdminJourneyDefinition<MedicalSpecialtyJourneyState> = {
  createState: () => ({
    specialtyId: undefined,
    specialtyName: `E2E Specialty ${Date.now()}`,
  }),
  description: 'Create a medical specialty from the admin UI.',
  journeyId: 'admin.medical-specialties.create',
  metadata: {
    collections: ['medical-specialties'],
    consumers: ['smoke', 'capture'],
    entrypoints: ['collection-create'],
    riskTags: ['medical-taxonomy', 'admin-crud'],
  },
  persona: 'admin',
  steps: createCollectionCreateFragment<MedicalSpecialtyJourneyState, 'specialtyId'>({
    afterSave: [
      createAssertFieldValueStep({
        expectedValue: (state) => state.specialtyName,
        fieldLabel: 'Name',
        label: 'Verify the medical specialty stays visible after save',
        stepId: 'assert-medical-specialty-name',
      }),
    ],
    collectionSlug: 'medical-specialties',
    fill: createFillMedicalSpecialtyStep({
      stepId: 'fill-medical-specialty-form',
      checkpoint: {
        label: 'Medical specialty form filled',
        screenshotSlug: 'medical-specialty-form-filled',
      },
    }),
    open: {
      label: 'Open the medical specialty create page',
      stepId: 'open-specialty-create-page',
      checkpoint: {
        label: 'Medical specialty create page',
        screenshotSlug: 'medical-specialty-create-page',
      },
    },
    recordIdField: 'specialtyId',
    save: {
      label: 'Save the medical specialty',
      stepId: 'save-medical-specialty',
      checkpoint: {
        label: 'Medical specialty saved',
        screenshotSlug: 'medical-specialty-saved',
      },
    },
  }),
}

export const doctorSpecialtyLinkJourney: AdminJourneyDefinition<DoctorSpecialtyJourneyState> = {
  createState: () => ({
    clinicId: undefined,
    doctorFullName: '',
    doctorId: undefined,
    doctorSpecialtyId: undefined,
    specialtyId: undefined,
    specialtyName: '',
  }),
  description: 'Link an existing doctor to a medical specialty through the admin UI.',
  journeyId: 'admin.doctorspecialties.create-link',
  metadata: {
    collections: ['clinics', 'doctors', 'doctorspecialties', 'medical-specialties'],
    consumers: ['smoke', 'capture'],
    entrypoints: ['collection-create'],
    riskTags: ['doctor-specialty', 'medical-network'],
  },
  persona: 'admin',
  steps: defineJourneySteps<DoctorSpecialtyJourneyState>(
    [
      createEnsureDoctorFixtureStep({
        stepId: 'ensure-doctor-fixture',
      }),
      createEnsureMedicalSpecialtyFixtureStep({
        stepId: 'ensure-specialty-fixture',
      }),
    ],
    createCollectionCreateFragment<DoctorSpecialtyJourneyState, 'doctorSpecialtyId'>({
      collectionSlug: 'doctorspecialties',
      fill: createFillDoctorSpecialtyRelationStep({
        stepId: 'fill-doctor-specialty-relation',
        checkpoint: {
          label: 'Doctor specialty relation filled',
          screenshotSlug: 'doctor-specialty-form-filled',
        },
      }),
      open: {
        label: 'Open the doctor specialty create page',
        stepId: 'open-doctor-specialty-create-page',
        checkpoint: {
          label: 'Doctor specialty create page',
          screenshotSlug: 'doctor-specialty-create-page',
        },
      },
      recordIdField: 'doctorSpecialtyId',
      save: {
        label: 'Save the doctor specialty relation',
        stepId: 'save-doctor-specialty-relation',
        checkpoint: {
          label: 'Doctor specialty relation saved',
          screenshotSlug: 'doctor-specialty-saved',
        },
      },
    }),
  ),
}

export const medicalNetworkRegressionJourney: AdminJourneyDefinition<DoctorSpecialtyJourneyState> = {
  createState: () => ({
    clinicId: undefined,
    doctorFullName: '',
    doctorId: undefined,
    doctorSpecialtyId: undefined,
    specialtyId: undefined,
    specialtyName: `E2E Relation Specialty ${Date.now()}`,
  }),
  description: 'Create a medical specialty in the UI and then link an existing doctor to it.',
  journeyId: 'admin.medical-network.create-specialty-and-link-doctor',
  metadata: {
    collections: ['clinics', 'doctors', 'doctorspecialties', 'medical-specialties'],
    consumers: ['regression', 'capture'],
    entrypoints: ['collection-create'],
    riskTags: ['dependent-chain', 'doctor-specialty', 'medical-network'],
  },
  persona: 'admin',
  steps: defineJourneySteps<DoctorSpecialtyJourneyState>(
    createCollectionCreateFragment<DoctorSpecialtyJourneyState, 'specialtyId'>({
      collectionSlug: 'medical-specialties',
      fill: createFillMedicalSpecialtyStep({
        stepId: 'fill-medical-specialty',
        checkpoint: {
          label: 'Medical network specialty filled',
          screenshotSlug: 'medical-network-specialty-filled',
        },
      }),
      open: {
        label: 'Open the medical specialty create page',
        stepId: 'open-medical-specialty-create-page',
        checkpoint: {
          label: 'Medical network create page',
          screenshotSlug: 'medical-network-specialty-create-page',
        },
      },
      recordIdField: 'specialtyId',
      save: {
        label: 'Save the medical specialty',
        stepId: 'save-medical-specialty',
        checkpoint: {
          label: 'Medical network specialty saved',
          screenshotSlug: 'medical-network-specialty-saved',
        },
      },
    }),
    [
      createEnsureDoctorFixtureStep({
        stepId: 'ensure-dependent-doctor-fixture',
      }),
    ],
    createCollectionCreateFragment<DoctorSpecialtyJourneyState, 'doctorSpecialtyId'>({
      collectionSlug: 'doctorspecialties',
      fill: createFillDoctorSpecialtyRelationStep({
        stepId: 'fill-doctor-specialty-relation',
        checkpoint: {
          label: 'Medical network relation filled',
          screenshotSlug: 'medical-network-relation-filled',
        },
      }),
      open: {
        label: 'Open the doctor specialty create page',
        stepId: 'open-doctor-specialty-create-page',
      },
      recordIdField: 'doctorSpecialtyId',
      save: {
        label: 'Save the doctor specialty relation',
        stepId: 'save-doctor-specialty-relation',
        checkpoint: {
          label: 'Medical network relation saved',
          screenshotSlug: 'medical-network-relation-saved',
        },
      },
    }),
  ),
}

export const clinicDoctorSpecialtyJourney: AdminJourneyDefinition<ClinicDoctorSpecialtyJourneyState> = {
  createState: () => ({
    doctorFullName: '',
    doctorId: undefined,
    doctorSpecialtyId: undefined,
    specialtyId: undefined,
    specialtyName: '',
  }),
  description: 'Create a doctor as clinic staff and link the doctor to a specialty.',
  journeyId: 'clinic.doctors.create-and-link-specialty',
  metadata: {
    collections: ['doctors', 'doctorspecialties', 'medical-specialties'],
    consumers: ['regression', 'capture'],
    entrypoints: ['collection-create'],
    riskTags: ['clinic-access', 'doctor-specialty', 'clinic-staff'],
  },
  persona: 'clinic',
  steps: defineJourneySteps<ClinicDoctorSpecialtyJourneyState>(
    createCollectionCreateFragment<ClinicDoctorSpecialtyJourneyState, 'doctorId'>({
      collectionSlug: 'doctors',
      fill: createFillDoctorProfileStep({
        stepId: 'fill-doctor-profile',
        checkpoint: {
          label: 'Clinic doctor form filled',
          screenshotSlug: 'clinic-doctor-form-filled',
        },
      }),
      open: {
        label: 'Open the doctor create page',
        stepId: 'open-doctor-create-page',
        checkpoint: {
          label: 'Clinic doctor create page',
          screenshotSlug: 'clinic-doctor-create-page',
        },
      },
      recordIdField: 'doctorId',
      save: {
        label: 'Save the clinic doctor',
        stepId: 'save-clinic-doctor',
        checkpoint: {
          label: 'Clinic doctor saved',
          screenshotSlug: 'clinic-doctor-saved',
        },
      },
    }),
    createCollectionCreateFragment<ClinicDoctorSpecialtyJourneyState, 'doctorSpecialtyId'>({
      collectionSlug: 'doctorspecialties',
      fill: createFillDoctorSpecialtyRelationStep({
        stepId: 'fill-clinic-doctor-specialty-relation',
        checkpoint: {
          label: 'Clinic doctor specialty relation filled',
          screenshotSlug: 'clinic-doctor-specialty-filled',
        },
      }),
      open: {
        label: 'Open the doctor specialty create page',
        stepId: 'open-clinic-doctor-specialty-create-page',
      },
      recordIdField: 'doctorSpecialtyId',
      save: {
        label: 'Save the clinic doctor specialty relation',
        stepId: 'save-clinic-doctor-specialty-relation',
        checkpoint: {
          label: 'Clinic doctor specialty saved',
          screenshotSlug: 'clinic-doctor-specialty-saved',
        },
      },
    }),
  ),
}
