import type { AdminJourneyDefinition } from '../types'
import {
  createCollectionCreateFragment,
  createJoinDrawerRelationFragment,
  createOpenDocumentFragment,
  defineJourneySteps,
} from '../fragments'
import {
  createAssertFieldValueStep,
  createCaptureClinicTreatmentIdStep,
  createCaptureDoctorTreatmentIdStep,
  createEnsureClinicFixtureStep,
  createEnsureDoctorFixtureStep,
  createEnsureMedicalSpecialtyFixtureStep,
  createEnsureTreatmentFixtureStep,
  createFillClinicTreatmentStep,
  createFillDoctorProfileStep,
  createFillDoctorTreatmentStep,
  createFillTreatmentStep,
} from '../steps'

type RecordId = number | string

type TreatmentJourneyState = {
  specialtyId?: RecordId
  specialtyName: string
  treatmentId?: string
  treatmentName: string
}

type ClinicTreatmentJourneyState = {
  clinicId?: RecordId
  clinicName: string
  clinicTreatmentId?: RecordId
  price: string
  specialtyId?: RecordId
  specialtyName: string
  treatmentId?: RecordId
  treatmentName: string
}

type DoctorTreatmentJourneyState = {
  clinicId?: RecordId
  clinicName: string
  doctorFullName: string
  doctorId?: RecordId
  doctorTreatmentId?: RecordId
  specializationLevel?: string
  specialtyId?: RecordId
  specialtyName: string
  treatmentId?: RecordId
  treatmentName: string
}

type MedicalNetworkTreatmentJourneyState = {
  clinicId?: RecordId
  clinicName: string
  clinicTreatmentId?: RecordId
  doctorFullName: string
  doctorId?: RecordId
  doctorTreatmentId?: RecordId
  price: string
  specialtyId?: RecordId
  specialtyName: string
  specializationLevel?: string
  treatmentId?: RecordId
  treatmentName: string
}

type ClinicDoctorTreatmentJourneyState = {
  doctorFullName: string
  doctorId?: RecordId
  doctorTreatmentId?: RecordId
  specializationLevel?: string
  treatmentId?: RecordId
  treatmentName: string
}

export const treatmentCreateJourney: AdminJourneyDefinition<TreatmentJourneyState> = {
  createState: () => ({
    specialtyId: undefined,
    specialtyName: '',
    treatmentId: undefined,
    treatmentName: `E2E Treatment ${Date.now()}`,
  }),
  description: 'Create a treatment from the admin UI.',
  journeyId: 'admin.treatments.create',
  metadata: {
    collections: ['medical-specialties', 'treatments'],
    consumers: ['smoke', 'capture'],
    entrypoints: ['collection-create'],
    riskTags: ['treatment-create', 'medical-network'],
  },
  persona: 'admin',
  steps: defineJourneySteps<TreatmentJourneyState>(
    [
      createEnsureMedicalSpecialtyFixtureStep({
        stepId: 'ensure-treatment-specialty-fixture',
      }),
    ],
    createCollectionCreateFragment<TreatmentJourneyState, 'treatmentId'>({
      afterSave: [
        createAssertFieldValueStep({
          expectedValue: (state) => state.treatmentName,
          fieldLabel: 'Name',
          label: 'Verify the treatment stays visible after save',
          stepId: 'assert-treatment-name',
        }),
      ],
      collectionSlug: 'treatments',
      fill: createFillTreatmentStep({
        stepId: 'fill-treatment-form',
        checkpoint: {
          label: 'Treatment form filled',
          screenshotSlug: 'treatment-form-filled',
        },
      }),
      open: {
        label: 'Open the treatment create page',
        stepId: 'open-treatment-create-page',
        checkpoint: {
          label: 'Treatment create page',
          screenshotSlug: 'treatment-create-page',
        },
      },
      recordIdField: 'treatmentId',
      save: {
        label: 'Save the treatment',
        stepId: 'save-treatment',
        checkpoint: {
          label: 'Treatment saved',
          screenshotSlug: 'treatment-saved',
        },
      },
    }),
  ),
}

export const clinicTreatmentLinkJourney: AdminJourneyDefinition<ClinicTreatmentJourneyState> = {
  createState: () => ({
    clinicId: undefined,
    clinicName: '',
    clinicTreatmentId: undefined,
    price: '3500',
    specialtyId: undefined,
    specialtyName: '',
    treatmentId: undefined,
    treatmentName: '',
  }),
  description: 'Link a clinic to a treatment through the clinic treatment collection.',
  journeyId: 'admin.clinictreatments.create-link',
  metadata: {
    collections: ['clinics', 'clinictreatments', 'medical-specialties', 'treatments'],
    consumers: ['capture'],
    entrypoints: ['collection-create'],
    riskTags: ['clinic-treatment', 'medical-network'],
  },
  persona: 'admin',
  steps: defineJourneySteps<ClinicTreatmentJourneyState>(
    [
      createEnsureClinicFixtureStep({
        reuseExisting: false,
        stepId: 'ensure-clinic-fixture',
      }),
      createEnsureMedicalSpecialtyFixtureStep({
        stepId: 'ensure-clinic-treatment-specialty-fixture',
      }),
      createEnsureTreatmentFixtureStep({
        reuseExisting: false,
        stepId: 'ensure-treatment-fixture',
      }),
    ],
    createCollectionCreateFragment<ClinicTreatmentJourneyState, 'clinicTreatmentId'>({
      collectionSlug: 'clinictreatments',
      fill: createFillClinicTreatmentStep({
        stepId: 'fill-clinic-treatment-form',
        checkpoint: {
          label: 'Clinic treatment form filled',
          screenshotSlug: 'clinic-treatment-form-filled',
        },
      }),
      open: {
        label: 'Open the clinic treatment create page',
        stepId: 'open-clinic-treatment-create-page',
        checkpoint: {
          label: 'Clinic treatment create page',
          screenshotSlug: 'clinic-treatment-create-page',
        },
      },
      recordIdField: 'clinicTreatmentId',
      save: {
        label: 'Save the clinic treatment relation',
        stepId: 'save-clinic-treatment',
        checkpoint: {
          label: 'Clinic treatment relation saved',
          screenshotSlug: 'clinic-treatment-saved',
        },
      },
    }),
  ),
}

export const doctorTreatmentLinkJourney: AdminJourneyDefinition<DoctorTreatmentJourneyState> = {
  createState: () => ({
    clinicId: undefined,
    clinicName: '',
    doctorFullName: '',
    doctorId: undefined,
    doctorTreatmentId: undefined,
    specializationLevel: 'Specialist',
    specialtyId: undefined,
    specialtyName: '',
    treatmentId: undefined,
    treatmentName: '',
  }),
  description: 'Link a doctor to a treatment through the doctor treatment collection.',
  journeyId: 'admin.doctortreatments.create-link',
  metadata: {
    collections: ['clinics', 'doctors', 'doctortreatments', 'medical-specialties', 'treatments'],
    consumers: ['capture'],
    entrypoints: ['collection-create'],
    riskTags: ['doctor-treatment', 'medical-network'],
  },
  persona: 'admin',
  steps: defineJourneySteps<DoctorTreatmentJourneyState>(
    [
      createEnsureClinicFixtureStep({
        reuseExisting: false,
        stepId: 'ensure-doctor-treatment-clinic-fixture',
      }),
      createEnsureDoctorFixtureStep({
        stepId: 'ensure-doctor-fixture',
      }),
      createEnsureMedicalSpecialtyFixtureStep({
        stepId: 'ensure-doctor-treatment-specialty-fixture',
      }),
      createEnsureTreatmentFixtureStep({
        reuseExisting: false,
        stepId: 'ensure-treatment-fixture',
      }),
    ],
    createCollectionCreateFragment<DoctorTreatmentJourneyState, 'doctorTreatmentId'>({
      collectionSlug: 'doctortreatments',
      fill: createFillDoctorTreatmentStep({
        stepId: 'fill-doctor-treatment-form',
        checkpoint: {
          label: 'Doctor treatment form filled',
          screenshotSlug: 'doctor-treatment-form-filled',
        },
      }),
      open: {
        label: 'Open the doctor treatment create page',
        stepId: 'open-doctor-treatment-create-page',
        checkpoint: {
          label: 'Doctor treatment create page',
          screenshotSlug: 'doctor-treatment-create-page',
        },
      },
      recordIdField: 'doctorTreatmentId',
      save: {
        label: 'Save the doctor treatment relation',
        stepId: 'save-doctor-treatment',
        checkpoint: {
          label: 'Doctor treatment relation saved',
          screenshotSlug: 'doctor-treatment-saved',
        },
      },
    }),
  ),
}

export const treatmentJoinClinicJourney: AdminJourneyDefinition<ClinicTreatmentJourneyState> = {
  createState: () => ({
    clinicId: undefined,
    clinicName: '',
    clinicTreatmentId: undefined,
    price: '3500',
    specialtyId: undefined,
    specialtyName: '',
    treatmentId: undefined,
    treatmentName: '',
  }),
  description: 'Open a treatment document and add a clinic treatment from the join drawer.',
  journeyId: 'admin.treatments.add-clinictreatment-from-join',
  metadata: {
    collections: ['clinics', 'clinictreatments', 'medical-specialties', 'treatments'],
    consumers: ['capture'],
    entrypoints: ['document-page', 'join-drawer'],
    riskTags: ['clinic-treatment', 'join-drawer', 'medical-network'],
  },
  persona: 'admin',
  steps: defineJourneySteps<ClinicTreatmentJourneyState>(
    [
      createEnsureClinicFixtureStep({
        reuseExisting: false,
        stepId: 'ensure-clinic-fixture',
      }),
      createEnsureMedicalSpecialtyFixtureStep({
        stepId: 'ensure-treatment-specialty-fixture',
      }),
      createEnsureTreatmentFixtureStep({
        reuseExisting: false,
        stepId: 'ensure-treatment-fixture',
      }),
    ],
    createJoinDrawerRelationFragment<ClinicTreatmentJourneyState, 'treatmentId'>({
      capture: createCaptureClinicTreatmentIdStep({
        label: 'Resolve the created clinic treatment id',
        stepId: 'capture-clinic-treatment-id',
      }),
      drawer: {
        fieldPath: 'Clinics',
        label: 'Open the clinic treatment join drawer',
        stepId: 'open-clinic-treatment-join-drawer',
        checkpoint: {
          label: 'Clinic treatment drawer opened',
          screenshotSlug: 'treatment-clinic-join-drawer-open',
        },
      },
      fill: createFillClinicTreatmentStep({
        stepId: 'fill-clinic-treatment-form',
        checkpoint: {
          label: 'Clinic treatment drawer filled',
          screenshotSlug: 'treatment-clinic-join-filled',
        },
      }),
      openDocument: {
        collectionSlug: 'treatments',
        label: 'Open the treatment document',
        recordIdField: 'treatmentId',
        stepId: 'open-treatment-document',
        checkpoint: {
          label: 'Treatment document opened',
          screenshotSlug: 'treatment-document-opened',
        },
      },
      save: {
        label: 'Save the clinic treatment drawer',
        stepId: 'save-clinic-treatment-drawer',
        checkpoint: {
          label: 'Clinic treatment drawer saved',
          screenshotSlug: 'treatment-clinic-join-saved',
        },
      },
      tab: {
        label: 'Open the associated clinics tab',
        stepId: 'open-associated-clinics-tab',
        tabLabel: 'Associated Clinics',
      },
    }),
  ),
}

export const treatmentJoinDoctorJourney: AdminJourneyDefinition<DoctorTreatmentJourneyState> = {
  createState: () => ({
    clinicId: undefined,
    clinicName: '',
    doctorFullName: '',
    doctorId: undefined,
    doctorTreatmentId: undefined,
    specializationLevel: 'Specialist',
    specialtyId: undefined,
    specialtyName: '',
    treatmentId: undefined,
    treatmentName: '',
  }),
  description: 'Open a treatment document and add a doctor treatment from the join drawer.',
  journeyId: 'admin.treatments.add-doctortreatment-from-join',
  metadata: {
    collections: ['clinics', 'doctors', 'doctortreatments', 'medical-specialties', 'treatments'],
    consumers: ['capture'],
    entrypoints: ['document-page', 'join-drawer'],
    riskTags: ['doctor-treatment', 'join-drawer', 'medical-network'],
  },
  persona: 'admin',
  steps: defineJourneySteps<DoctorTreatmentJourneyState>(
    [
      createEnsureClinicFixtureStep({
        reuseExisting: false,
        stepId: 'ensure-treatment-join-clinic-fixture',
      }),
      createEnsureDoctorFixtureStep({
        stepId: 'ensure-treatment-join-doctor-fixture',
      }),
      createEnsureMedicalSpecialtyFixtureStep({
        stepId: 'ensure-treatment-specialty-fixture',
      }),
      createEnsureTreatmentFixtureStep({
        reuseExisting: false,
        stepId: 'ensure-treatment-fixture',
      }),
    ],
    createJoinDrawerRelationFragment<DoctorTreatmentJourneyState, 'treatmentId'>({
      capture: createCaptureDoctorTreatmentIdStep({
        label: 'Resolve the created doctor treatment id',
        stepId: 'capture-doctor-treatment-id',
      }),
      drawer: {
        fieldPath: 'Doctors',
        label: 'Open the doctor treatment join drawer',
        stepId: 'open-doctor-treatment-join-drawer',
        checkpoint: {
          label: 'Doctor treatment drawer opened',
          screenshotSlug: 'treatment-doctor-join-drawer-open',
        },
      },
      fill: createFillDoctorTreatmentStep({
        stepId: 'fill-doctor-treatment-form',
        checkpoint: {
          label: 'Doctor treatment drawer filled',
          screenshotSlug: 'treatment-doctor-join-filled',
        },
      }),
      openDocument: {
        collectionSlug: 'treatments',
        label: 'Open the treatment document',
        recordIdField: 'treatmentId',
        stepId: 'open-treatment-document',
        checkpoint: {
          label: 'Treatment doctor document opened',
          screenshotSlug: 'treatment-doctor-document-opened',
        },
      },
      save: {
        label: 'Save the doctor treatment drawer',
        stepId: 'save-doctor-treatment-drawer',
        checkpoint: {
          label: 'Doctor treatment drawer saved',
          screenshotSlug: 'treatment-doctor-join-saved',
        },
      },
      tab: {
        label: 'Open the associated doctors tab',
        stepId: 'open-associated-doctors-tab',
        tabLabel: 'Associated Doctors',
      },
    }),
  ),
}

export const treatmentMedicalNetworkJourney: AdminJourneyDefinition<MedicalNetworkTreatmentJourneyState> = {
  createState: () => ({
    clinicId: undefined,
    clinicName: '',
    clinicTreatmentId: undefined,
    doctorFullName: '',
    doctorId: undefined,
    doctorTreatmentId: undefined,
    price: '3500',
    specialtyId: undefined,
    specialtyName: '',
    specializationLevel: 'Specialist',
    treatmentId: undefined,
    treatmentName: `E2E Treatment ${Date.now()}`,
  }),
  description:
    'Create a treatment in the UI, link a clinic from the treatment join tab, verify average price, and then link a doctor.',
  journeyId: 'admin.medical-network.create-treatment-and-link-clinic-and-doctor',
  metadata: {
    collections: ['clinics', 'clinictreatments', 'doctors', 'doctortreatments', 'medical-specialties', 'treatments'],
    consumers: ['regression', 'capture'],
    entrypoints: ['collection-create', 'document-page', 'join-drawer'],
    riskTags: ['dependent-chain', 'average-price', 'medical-network'],
  },
  persona: 'admin',
  steps: defineJourneySteps<MedicalNetworkTreatmentJourneyState>(
    [
      createEnsureMedicalSpecialtyFixtureStep({
        stepId: 'ensure-treatment-specialty-fixture',
      }),
    ],
    createCollectionCreateFragment<MedicalNetworkTreatmentJourneyState, 'treatmentId'>({
      collectionSlug: 'treatments',
      fill: createFillTreatmentStep({
        stepId: 'fill-treatment-form',
        checkpoint: {
          label: 'Medical network treatment filled',
          screenshotSlug: 'medical-network-treatment-filled',
        },
      }),
      open: {
        label: 'Open the treatment create page',
        stepId: 'open-treatment-create-page',
        checkpoint: {
          label: 'Medical network treatment create page',
          screenshotSlug: 'medical-network-treatment-create-page',
        },
      },
      recordIdField: 'treatmentId',
      save: {
        label: 'Save the treatment',
        stepId: 'save-treatment',
        checkpoint: {
          label: 'Medical network treatment saved',
          screenshotSlug: 'medical-network-treatment-saved',
        },
      },
    }),
    [
      createEnsureClinicFixtureStep({
        reuseExisting: false,
        stepId: 'ensure-clinic-fixture',
      }),
      createEnsureDoctorFixtureStep({
        stepId: 'ensure-doctor-fixture',
      }),
    ],
    createJoinDrawerRelationFragment<MedicalNetworkTreatmentJourneyState, 'treatmentId'>({
      capture: createCaptureClinicTreatmentIdStep({
        label: 'Resolve the created clinic treatment id',
        stepId: 'capture-clinic-treatment-id',
      }),
      drawer: {
        fieldPath: 'Clinics',
        label: 'Open the clinic treatment join drawer',
        stepId: 'open-clinic-treatment-join-drawer',
        checkpoint: {
          label: 'Medical network clinic drawer opened',
          screenshotSlug: 'medical-network-clinic-drawer-open',
        },
      },
      fill: createFillClinicTreatmentStep({
        stepId: 'fill-clinic-treatment-form',
        checkpoint: {
          label: 'Medical network clinic drawer filled',
          screenshotSlug: 'medical-network-clinic-drawer-filled',
        },
      }),
      openDocument: {
        collectionSlug: 'treatments',
        label: 'Re-open the treatment document',
        recordIdField: 'treatmentId',
        stepId: 'reopen-treatment-document',
      },
      save: {
        label: 'Save the clinic treatment drawer',
        stepId: 'save-clinic-treatment-drawer',
        checkpoint: {
          label: 'Medical network clinic drawer saved',
          screenshotSlug: 'medical-network-clinic-drawer-saved',
        },
      },
      tab: {
        label: 'Open the associated clinics tab',
        stepId: 'open-associated-clinics-tab',
        tabLabel: 'Associated Clinics',
      },
    }),
    createOpenDocumentFragment<MedicalNetworkTreatmentJourneyState, 'treatmentId'>({
      collectionSlug: 'treatments',
      label: 'Reload the treatment document for derived fields',
      recordIdField: 'treatmentId',
      stepId: 'reload-treatment-document-for-average-price',
    }),
    [
      createAssertFieldValueStep({
        expectedValue: (state) => state.price,
        fieldLabel: 'Average Price',
        label: 'Verify average price matches the first clinic treatment price',
        stepId: 'assert-average-price',
        checkpoint: {
          label: 'Average price updated',
          screenshotSlug: 'medical-network-average-price-updated',
        },
      }),
    ],
    createJoinDrawerRelationFragment<MedicalNetworkTreatmentJourneyState, 'treatmentId'>({
      capture: createCaptureDoctorTreatmentIdStep({
        label: 'Resolve the created doctor treatment id',
        stepId: 'capture-doctor-treatment-id',
      }),
      drawer: {
        fieldPath: 'Doctors',
        label: 'Open the doctor treatment join drawer',
        stepId: 'open-doctor-treatment-join-drawer',
        checkpoint: {
          label: 'Medical network doctor drawer opened',
          screenshotSlug: 'medical-network-doctor-drawer-open',
        },
      },
      fill: createFillDoctorTreatmentStep({
        stepId: 'fill-doctor-treatment-form',
        checkpoint: {
          label: 'Medical network doctor drawer filled',
          screenshotSlug: 'medical-network-doctor-drawer-filled',
        },
      }),
      save: {
        label: 'Save the doctor treatment drawer',
        stepId: 'save-doctor-treatment-drawer',
        checkpoint: {
          label: 'Medical network doctor drawer saved',
          screenshotSlug: 'medical-network-doctor-drawer-saved',
        },
      },
      tab: {
        label: 'Open the associated doctors tab',
        stepId: 'open-associated-doctors-tab',
        tabLabel: 'Associated Doctors',
      },
    }),
  ),
}

export const clinicDoctorTreatmentJourney: AdminJourneyDefinition<ClinicDoctorTreatmentJourneyState> = {
  createState: () => ({
    doctorFullName: '',
    doctorId: undefined,
    doctorTreatmentId: undefined,
    specializationLevel: 'Specialist',
    treatmentId: undefined,
    treatmentName: '',
  }),
  description: 'Create a doctor as clinic staff and link the doctor to a treatment from the doctor join drawer.',
  journeyId: 'clinic.doctors.create-and-link-treatment',
  metadata: {
    collections: ['doctors', 'doctortreatments', 'treatments'],
    consumers: ['regression', 'capture'],
    entrypoints: ['collection-create', 'join-drawer'],
    riskTags: ['clinic-access', 'doctor-treatment', 'clinic-staff'],
  },
  persona: 'clinic',
  steps: defineJourneySteps<ClinicDoctorTreatmentJourneyState>(
    createCollectionCreateFragment<ClinicDoctorTreatmentJourneyState, 'doctorId'>({
      collectionSlug: 'doctors',
      fill: createFillDoctorProfileStep({
        stepId: 'fill-doctor-profile',
        checkpoint: {
          label: 'Clinic doctor treatment form filled',
          screenshotSlug: 'clinic-doctor-treatment-form-filled',
        },
      }),
      open: {
        label: 'Open the doctor create page',
        stepId: 'open-doctor-create-page',
        checkpoint: {
          label: 'Clinic doctor treatment create page',
          screenshotSlug: 'clinic-doctor-treatment-create-page',
        },
      },
      recordIdField: 'doctorId',
      save: {
        label: 'Save the clinic doctor',
        stepId: 'save-clinic-doctor',
        checkpoint: {
          label: 'Clinic doctor treatment doctor saved',
          screenshotSlug: 'clinic-doctor-treatment-doctor-saved',
        },
      },
    }),
    createJoinDrawerRelationFragment<ClinicDoctorTreatmentJourneyState, 'doctorId'>({
      capture: createCaptureDoctorTreatmentIdStep({
        label: 'Resolve the created doctor treatment id',
        stepId: 'capture-doctor-treatment-id',
      }),
      drawer: {
        fieldPath: 'treatments',
        label: 'Open the doctor treatment join drawer',
        stepId: 'open-doctor-treatment-join-drawer',
        checkpoint: {
          label: 'Clinic doctor treatment join drawer opened',
          screenshotSlug: 'clinic-doctor-treatment-join-drawer-open',
        },
      },
      fill: createFillDoctorTreatmentStep({
        stepId: 'fill-doctor-treatment-form',
        checkpoint: {
          label: 'Clinic doctor treatment join drawer filled',
          screenshotSlug: 'clinic-doctor-treatment-join-drawer-filled',
        },
      }),
      save: {
        label: 'Save the doctor treatment drawer',
        stepId: 'save-doctor-treatment-drawer',
        checkpoint: {
          label: 'Clinic doctor treatment join drawer saved',
          screenshotSlug: 'clinic-doctor-treatment-join-drawer-saved',
        },
      },
      tab: {
        label: 'Open the specialties and treatments tab',
        stepId: 'open-doctor-specialties-and-treatments-tab',
        tabLabel: 'Specialties & Treatments',
      },
    }),
  ),
}
