/**
 * Permission Matrix – Single Source of Truth
 *
 * This file defines, in a typed and well documented format, the access expectations
 * for every Payload collection in the project. The goal is to maintain one
 * deterministic configuration that tooling, automated tests, and the markdown
 * documentation can all derive from.
 *
 * How to use this file:
 * - Update the structures below when access behaviour changes or a new
 *   collection/role is introduced.
 * - Run `pnpm matrix:derive` afterwards to regenerate the derived JSON snapshot
 *   and the printable markdown table.
 * - Run `pnpm matrix:verify` (or `pnpm check`) to ensure the implemented access
 *   rules and documentation stay aligned with this configuration.
 */

export type AccessType = 'platform' | 'anyone' | 'published' | 'conditional'

export interface AccessExpectation {
  /**
   * High-level classification used by tests and tooling to assert behaviour.
   * - `platform`: unrestricted platform-staff access.
   * - `anyone`: available to everyone without authentication.
   * - `published`: world readable, but only when the entry is published/approved.
   * - `conditional`: requires additional checks (see `details`).
   */
  type: AccessType
  /** Human readable explanation of the conditional behaviour or scope. */
  details?: string
}

export interface OperationMatrix {
  create?: AccessExpectation
  read: AccessExpectation
  update?: AccessExpectation
  delete?: AccessExpectation
  admin?: AccessExpectation
  readVersions?: AccessExpectation
}

export type OperationKey = keyof OperationMatrix

export type UserType = 'platform' | 'clinic' | 'patient' | 'anonymous'

export type ConditionalScenarioKind =
  // Always false: access should consistently return false regardless of user context.
  | 'always-false'
  // Clinic approved: non-platform users must receive a filter enforcing the approved status check.
  | 'clinic-approved'
  // Clinic scope: response must scope by clinic identifier for non-platform users.
  | 'clinic-scope'
  // Clinic staff update: clinic staff can update only their own profile user relation.
  | 'clinic-staff-update'
  // Patient scope: restricts non-platform reads/writes to documents owned by the patient user.
  | 'patient-scope'
  // Patient update self: patient boolean response should reflect whether they target their own record.
  | 'patient-update-self'
  // Role allow: only explicitly listed roles receive boolean true, others false.
  | 'role-allow'
  // Clinic media create: ensure clinic uploads are allowed solely when payload data references the staff clinic.
  | 'clinic-media-create'
  // Doctor media create: clinic staff result depends on doctor ownership; others denied.
  | 'doctor-media-create'
  // User profile media own: expect filters tying asset ownership back to the requesting user.
  | 'user-profile-media-own'
  // User profile media create: clinic/patient uploads must target their own profile relation.
  | 'user-profile-media-create'

export interface ConditionalScenarioMeta {
  kind: ConditionalScenarioKind
  path?: string
  value?: string
  allow?: UserType[]
}

export interface PublishedMeta {
  field?: string
  value?: string
  filters?: Partial<Record<UserType, unknown>>
}

export interface CollectionMeta {
  published?: PublishedMeta
  conditional?: Partial<Record<OperationKey, ConditionalScenarioMeta>>
}

export interface MatrixRow {
  /** Payload collection slug */
  slug: string
  /** Display name used in documentation */
  displayName: string
  /**
   * Expected permissions for each CRUD/admin action. The config deliberately
   * mirrors the shape consumed by the Vitest permission suite so that the same
   * data drives both documentation and automated verification.
   */
  operations: OperationMatrix
  /** Optional notes shown in documentation. */
  notes?: string
  /** Optional metadata powering automated verification helpers. */
  meta?: CollectionMeta
}

export interface PermissionMatrix {
  version: string
  source: string
  collections: Record<string, MatrixRow>
}

export const permissionMatrix: PermissionMatrix = {
  version: '1.0.0',
  source: 'src/security/permission-matrix.config.ts',
  collections: {
    basicUsers: {
      slug: 'basicUsers',
      displayName: 'BasicUsers',
      operations: {
        create: { type: 'platform' },
        read: { type: 'platform' },
        update: { type: 'platform' },
        delete: { type: 'platform' },
        admin: { type: 'platform' },
      },
      notes: 'User management restricted to platform staff',
    },
    platformStaff: {
      slug: 'platformStaff',
      displayName: 'PlatformStaff',
      operations: {
        create: { type: 'conditional', details: 'disabled API create; managed via provisioning' },
        read: { type: 'platform' },
        update: { type: 'platform' },
        delete: { type: 'conditional', details: 'disabled API delete; managed via provisioning' },
        admin: { type: 'platform' },
      },
      meta: {
        conditional: {
          create: { kind: 'always-false' },
          delete: { kind: 'always-false' },
        },
      },
      notes: 'Platform staff management - indirect via BasicUsers lifecycle',
    },
    clinicStaff: {
      slug: 'clinicStaff',
      displayName: 'ClinicStaff',
      operations: {
        create: { type: 'conditional', details: 'disabled API create; managed via provisioning' },
        read: { type: 'conditional', details: 'platform full + clinic own clinic' },
        update: { type: 'conditional', details: 'platform + own profile only after approval' },
        delete: { type: 'conditional', details: 'disabled API delete; managed via provisioning' },
        admin: { type: 'platform' },
      },
      meta: {
        conditional: {
          create: { kind: 'always-false' },
          read: { kind: 'clinic-scope', path: 'clinic' },
          update: { kind: 'clinic-staff-update', path: 'user' },
          delete: { kind: 'always-false' },
        },
      },
      notes: 'Authentication denied until approval; RW post-approval own clinic + own profile update',
    },
    patients: {
      slug: 'patients',
      displayName: 'Patients',
      operations: {
        create: { type: 'platform' },
        read: { type: 'conditional', details: 'platform full + patient own profile' },
        update: { type: 'conditional', details: 'platform full + own profile only' },
        delete: { type: 'platform' },
        admin: { type: 'platform' },
      },
      meta: {
        conditional: {
          read: { kind: 'patient-scope', path: 'id' },
          update: { kind: 'patient-update-self' },
        },
      },
      notes: 'Patients can update own profile; no self-create/delete',
    },
    posts: {
      slug: 'posts',
      displayName: 'Posts',
      operations: {
        create: { type: 'platform' },
        read: { type: 'published' },
        update: { type: 'platform' },
        delete: { type: 'platform' },
        admin: { type: 'platform' },
      },
      notes: 'Blog content - platform write, published content readable by all',
    },
    pages: {
      slug: 'pages',
      displayName: 'Pages',
      operations: {
        create: { type: 'platform' },
        read: { type: 'published' },
        update: { type: 'platform' },
        delete: { type: 'platform' },
        admin: { type: 'platform' },
      },
      notes: 'Static pages - platform write, published content readable by all',
    },
    doctors: {
      slug: 'doctors',
      displayName: 'Doctors',
      operations: {
        create: { type: 'conditional', details: 'platform full + clinic scoped to own clinic' },
        read: { type: 'anyone' },
        update: { type: 'conditional', details: 'platform full + clinic scoped to own clinic' },
        delete: { type: 'platform' },
        admin: { type: 'conditional', details: 'platform full + clinic scoped to own clinic' },
      },
      meta: {
        conditional: {
          create: { kind: 'clinic-scope', path: 'clinic' },
          update: { kind: 'clinic-scope', path: 'clinic' },
          admin: { kind: 'clinic-scope', path: 'clinic' },
        },
      },
      notes: 'Platform RWDA, clinic RWA own clinic, patients/anonymous R',
    },
    clinics: {
      slug: 'clinics',
      displayName: 'Clinics',
      operations: {
        create: { type: 'platform' },
        read: { type: 'conditional', details: 'anyone approved, platform all' },
        update: { type: 'conditional', details: 'platform full + clinic own profile only' },
        delete: { type: 'platform' },
        admin: { type: 'platform' },
      },
      meta: {
        conditional: {
          read: { kind: 'clinic-approved', path: 'status', value: 'approved' },
          update: { kind: 'clinic-scope', path: 'id' },
        },
      },
      notes: 'Platform RWDA, clinic RW own profile, patients/anonymous R approved',
    },
    doctorspecialties: {
      slug: 'doctorspecialties',
      displayName: 'DoctorSpecialties',
      operations: {
        create: { type: 'conditional', details: 'platform full + clinic scoped to own clinic' },
        read: { type: 'anyone' },
        update: { type: 'conditional', details: 'platform full + clinic scoped to own clinic' },
        delete: { type: 'platform' },
        admin: { type: 'conditional', details: 'platform full + clinic scoped to own clinic' },
      },
      meta: {
        conditional: {
          create: { kind: 'clinic-scope', path: 'doctor.clinic' },
          update: { kind: 'clinic-scope', path: 'doctor.clinic' },
          admin: { kind: 'clinic-scope', path: 'doctor.clinic' },
        },
      },
      notes: 'Platform RWDA, clinic RWA own clinic, patients/anonymous R',
    },
    doctortreatments: {
      slug: 'doctortreatments',
      displayName: 'DoctorTreatments',
      operations: {
        create: { type: 'conditional', details: 'platform full + clinic scoped to own clinic' },
        read: { type: 'anyone' },
        update: { type: 'conditional', details: 'platform full + clinic scoped to own clinic' },
        delete: { type: 'platform' },
        admin: { type: 'conditional', details: 'platform full + clinic scoped to own clinic' },
      },
      meta: {
        conditional: {
          create: { kind: 'clinic-scope', path: 'doctor.clinic' },
          update: { kind: 'clinic-scope', path: 'doctor.clinic' },
          admin: { kind: 'clinic-scope', path: 'doctor.clinic' },
        },
      },
      notes: 'Platform RWDA, clinic RWA own clinic, patients/anonymous R',
    },
    clinictreatments: {
      slug: 'clinictreatments',
      displayName: 'ClinicTreatments',
      operations: {
        create: { type: 'conditional', details: 'platform full + clinic scoped to own clinic' },
        read: { type: 'anyone' },
        update: { type: 'conditional', details: 'platform full + clinic scoped to own clinic' },
        delete: { type: 'platform' },
        admin: { type: 'conditional', details: 'platform full + clinic scoped to own clinic' },
      },
      meta: {
        conditional: {
          create: { kind: 'clinic-scope', path: 'clinic' },
          update: { kind: 'clinic-scope', path: 'clinic' },
          admin: { kind: 'clinic-scope', path: 'clinic' },
        },
      },
      notes: 'Platform RWDA, clinic RWA own clinic, patients/anonymous R',
    },
    favoriteclinics: {
      slug: 'favoriteclinics',
      displayName: 'FavoriteClinics',
      operations: {
        create: { type: 'conditional', details: 'platform full + patient own list' },
        read: { type: 'conditional', details: 'platform full + patient own list' },
        update: { type: 'conditional', details: 'platform full + patient own list' },
        delete: { type: 'conditional', details: 'platform full + patient own list' },
        admin: { type: 'conditional', details: 'platform full + patient own list' },
      },
      meta: {
        conditional: {
          create: { kind: 'role-allow', allow: ['platform', 'patient'] },
          read: { kind: 'patient-scope', path: 'patient' },
          update: { kind: 'patient-scope', path: 'patient' },
          delete: { kind: 'patient-scope', path: 'patient' },
          admin: { kind: 'patient-scope', path: 'patient' },
        },
      },
      notes: 'Platform RWDA, patients RWDA own list only',
    },
    reviews: {
      slug: 'reviews',
      displayName: 'Reviews',
      operations: {
        create: { type: 'conditional', details: 'platform full + patient create only' },
        read: { type: 'published' },
        update: { type: 'platform' },
        delete: { type: 'platform' },
        admin: { type: 'platform' },
      },
      meta: {
        published: {
          field: 'status',
          value: 'approved',
        },
        conditional: {
          create: { kind: 'role-allow', allow: ['platform', 'patient'] },
        },
      },
      notes: 'Platform RWDA moderation, patients W create only, all R approved',
    },
    treatments: {
      slug: 'treatments',
      displayName: 'Treatments',
      operations: {
        create: { type: 'platform' },
        read: { type: 'anyone' },
        update: { type: 'platform' },
        delete: { type: 'platform' },
        admin: { type: 'platform' },
      },
      notes: 'Master data - platform write, everyone read',
    },
    'medical-specialties': {
      slug: 'medical-specialties',
      displayName: 'MedicalSpecialties',
      operations: {
        create: { type: 'platform' },
        read: { type: 'anyone' },
        update: { type: 'platform' },
        delete: { type: 'platform' },
        admin: { type: 'platform' },
      },
      notes: 'Master data - platform write, everyone read',
    },
    countries: {
      slug: 'countries',
      displayName: 'Countries',
      operations: {
        create: { type: 'platform' },
        read: { type: 'anyone' },
        update: { type: 'platform' },
        delete: { type: 'platform' },
        admin: { type: 'platform' },
      },
      notes: 'Geographic data - platform write, everyone read',
    },
    cities: {
      slug: 'cities',
      displayName: 'Cities',
      operations: {
        create: { type: 'platform' },
        read: { type: 'anyone' },
        update: { type: 'platform' },
        delete: { type: 'platform' },
        admin: { type: 'platform' },
      },
      notes: 'Geographic data - platform write, everyone read',
    },
    platformContentMedia: {
      slug: 'platformContentMedia',
      displayName: 'PlatformContentMedia',
      operations: {
        create: { type: 'platform' },
        read: { type: 'anyone' },
        update: { type: 'platform' },
        delete: { type: 'platform' },
        admin: { type: 'platform' },
      },
      notes: 'Platform marketing assets - platform write, public read',
    },
    clinicMedia: {
      slug: 'clinicMedia',
      displayName: 'ClinicMedia',
      operations: {
        create: { type: 'conditional', details: 'platform full + clinic own clinic' },
        read: { type: 'conditional', details: 'served when referenced' },
        update: { type: 'conditional', details: 'platform full + clinic own clinic' },
        delete: { type: 'conditional', details: 'platform full + clinic own clinic' },
        admin: { type: 'platform' },
      },
      meta: {
        conditional: {
          create: { kind: 'clinic-media-create' },
          read: { kind: 'clinic-scope', path: 'clinic' },
          update: { kind: 'clinic-scope', path: 'clinic' },
          delete: { kind: 'clinic-scope', path: 'clinic' },
        },
      },
      notes: 'Clinic-owned files - platform RWDA, clinic RWD own clinic',
    },
    doctorMedia: {
      slug: 'doctorMedia',
      displayName: 'DoctorMedia',
      operations: {
        create: { type: 'conditional', details: 'platform full + clinic own clinic' },
        read: { type: 'conditional', details: 'served when referenced' },
        update: { type: 'conditional', details: 'platform full + clinic own clinic' },
        delete: { type: 'conditional', details: 'platform full + clinic own clinic' },
        admin: { type: 'platform' },
      },
      meta: {
        conditional: {
          create: { kind: 'doctor-media-create' },
          read: { kind: 'clinic-scope', path: 'clinic' },
          update: { kind: 'clinic-scope', path: 'clinic' },
          delete: { kind: 'clinic-scope', path: 'clinic' },
        },
      },
      notes: 'Doctor-owned images - similar scoping to ClinicMedia',
    },
    userProfileMedia: {
      slug: 'userProfileMedia',
      displayName: 'UserProfileMedia',
      operations: {
        create: { type: 'conditional', details: 'platform full + user own profile' },
        read: { type: 'conditional', details: 'platform full + staff profiles in own clinic + patient own' },
        update: { type: 'conditional', details: 'platform full + user own profile' },
        delete: { type: 'conditional', details: 'platform full + user own profile' },
        admin: { type: 'platform' },
      },
      meta: {
        conditional: {
          create: { kind: 'user-profile-media-create' },
          read: { kind: 'user-profile-media-own' },
          update: { kind: 'user-profile-media-own' },
          delete: { kind: 'user-profile-media-own' },
        },
      },
      notes: 'User & patient avatars - self or platform management',
    },
    tags: {
      slug: 'tags',
      displayName: 'Tags',
      operations: {
        create: { type: 'platform' },
        read: { type: 'anyone' },
        update: { type: 'platform' },
        delete: { type: 'platform' },
        admin: { type: 'platform' },
      },
      notes: 'Supporting data - platform write, everyone read',
    },
    categories: {
      slug: 'categories',
      displayName: 'Categories',
      operations: {
        create: { type: 'platform' },
        read: { type: 'anyone' },
        update: { type: 'platform' },
        delete: { type: 'platform' },
        admin: { type: 'platform' },
      },
      notes: 'Supporting data - platform write, everyone read',
    },
    accreditation: {
      slug: 'accreditation',
      displayName: 'Accreditation',
      operations: {
        create: { type: 'platform' },
        read: { type: 'anyone' },
        update: { type: 'platform' },
        delete: { type: 'platform' },
        admin: { type: 'platform' },
      },
      notes: 'Supporting data - platform write, everyone read',
    },
    clinicApplications: {
      slug: 'clinicApplications',
      displayName: 'ClinicApplications',
      operations: {
        create: { type: 'anyone' },
        read: { type: 'platform' },
        update: { type: 'platform' },
        delete: { type: 'platform' },
        admin: { type: 'platform' },
      },
      notes: 'Intake/applications - anonymous create, platform moderation',
    },
  },
}
