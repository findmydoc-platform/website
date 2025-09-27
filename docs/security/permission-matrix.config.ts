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
}

export interface PermissionMatrix {
  version: string
  source: string
  collections: Record<string, MatrixRow>
}

export const permissionMatrix: PermissionMatrix = {
  version: '1.0.0',
  source: 'docs/security/permission-matrix.config.ts',
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
