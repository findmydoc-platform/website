// storage-adapter-import-placeholder
import { postgresAdapter } from '@payloadcms/db-postgres'

import sharp from 'sharp'
import path from 'path'
import { buildConfig, PayloadHandler, type EmailAdapter } from 'payload'
import { cacheRevalidationVisibilityGetHandler } from './endpoints/cacheRevalidationVisibility'
import { seedPostHandler, seedGetHandler, seedAdvanceHandler, seedRetryHandler } from './endpoints/seed/seedEndpoint'
import { seedChunkTask } from './endpoints/seed/tasks/seedChunkTask'
import { fileURLToPath } from 'url'
import { config as dotenvConfig } from 'dotenv'
import { canRunPayloadJobs } from '@/access/payloadJobs'
import { createPayloadLoggerConfig } from '@/utilities/logging/payloadLogger'
import { createAdminDashboardConfig } from './dashboard/adminDashboard'

// Import Collections
import { Categories } from './collections/Categories'
import { PlatformContentMedia } from './collections/PlatformContentMedia'
import { Pages } from './collections/Pages'
import { Posts } from './collections/Posts'
import { PlatformStaff } from './collections/PlatformStaff'
import { Clinics } from './collections/Clinics'
import { ClinicApplications } from './collections/ClinicApplications'
import { PatientClinicInquiries } from './collections/PatientClinicInquiries'
import { Doctors } from './collections/Doctors'
import { Accreditation } from './collections/Accreditation'
import { MedicalSpecialties } from './collections/MedicalSpecialties'
import { Treatments } from './collections/Treatments'
import { ClinicTreatments } from './collections/ClinicTreatments'
import { DoctorTreatments } from './collections/DoctorTreatments'
import { DoctorSpecialties } from './collections/DoctorSpecialties'
import { Reviews } from './collections/Reviews'
import { Countries } from './collections/Countries'
import { Cities } from './collections/Cities'
import { Tags } from './collections/Tags'
import { BasicUsers } from './collections/BasicUsers'
import { Patients } from './collections/Patients'
import { ClinicStaff } from './collections/ClinicStaff'
import { FavoriteClinics } from './collections/FavoriteClinics'
import { ClinicMedia } from './collections/ClinicMedia'
import { DoctorMedia } from './collections/DoctorMedia'
import { UserProfileMedia } from './collections/UserProfileMedia'
import { ClinicGalleryMedia } from './collections/ClinicGalleryMedia'
import { ClinicGalleryEntries } from './collections/ClinicGalleryEntries'

// Import Globals
import { Footer } from './globals/Footer/config'
import { CookieConsent } from './globals/CookieConsent/config'
import { Header } from './globals/Header/config'
import { LandingPages } from './globals/LandingPages/config'
import { ensureManagedLegalContent } from './collections/Pages/legalPages'

// Import Plugins & Utilities
import { plugins } from './plugins'
import { defaultLexical } from '@/fields/defaultLexical'
import { getServerSideURL } from './utilities/getURL'
import { CONTENT_LOCALES, DEFAULT_CONTENT_LOCALE } from '@/utilities/contentLocalization'
import { MEDIA_UPLOAD_MAX_BYTES, MEDIA_UPLOAD_TOO_LARGE_MESSAGE } from '@/config/mediaUploadPolicy'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const adminDashboardConfig = createAdminDashboardConfig(process.env)

// Load only when running tests
if (process.env.NODE_ENV === 'test') {
  dotenvConfig({ path: path.resolve(dirname, '../.env.test') })
}

const isDbPushEnabled = process.env.PAYLOAD_DB_PUSH === 'true' && process.env.NODE_ENV !== 'test'
const shouldUseSilentEmailAdapter = process.env.CI === 'true' || process.env.NODE_ENV === 'test'

const silentEmailAdapter: EmailAdapter<void> = () => ({
  defaultFromAddress: 'noreply@findmydoc.invalid',
  defaultFromName: 'findmydoc',
  name: 'silent-ci-email',
  sendEmail: async () => undefined,
})

export default buildConfig({
  // Keep the complete multipart request below Vercel's 4.5 MB request limit.
  upload: {
    limits: {
      fileSize: MEDIA_UPLOAD_MAX_BYTES,
    },
    abortOnLimit: true,
    responseOnLimit: MEDIA_UPLOAD_TOO_LARGE_MESSAGE,
    safeFileNames: true,
  },
  endpoints: [
    { path: '/seed', method: 'post', handler: seedPostHandler as PayloadHandler },
    { path: '/seed', method: 'get', handler: seedGetHandler as PayloadHandler },
    { path: '/seed/retry', method: 'post', handler: seedRetryHandler as PayloadHandler },
    { path: '/seed/advance', method: 'get', handler: seedAdvanceHandler as PayloadHandler },
    {
      path: '/cache-revalidation/visibility',
      method: 'get',
      handler: cacheRevalidationVisibilityGetHandler as PayloadHandler,
    },
  ],
  admin: {
    dashboard: {
      widgets: adminDashboardConfig.widgets as never,
      defaultLayout: adminDashboardConfig.defaultLayout as never,
    },
    meta: {
      icons: [
        {
          rel: 'icon',
          type: 'image/svg+xml',
          url: '/favicon.svg?v=20260319',
        },
      ],
    },
    components: {
      graphics: {
        Icon: '@/components/organisms/AdminBranding/AdminNavIcon',
        Logo: '@/components/organisms/AdminBranding/AdminLoginLogo',
      },
      providers: ['@/components/organisms/AdminBranding/AdminThemeProvider'],
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
    routes: {
      login: '/login',
      // Keep Payload's empty-user redirect on the normal login route; public bootstrap paths are blocked separately.
      createFirstUser: '/login',
      logout: '/logout',
    },
    avatar: {
      Component: '@/components/organisms/AdminBranding/AdminAccountAvatar',
    },
    theme: 'light',
    user: PlatformStaff.slug,
    livePreview: {
      breakpoints: [
        {
          label: 'Mobile',
          name: 'mobile',
          width: 375,
          height: 667,
        },
        {
          label: 'Tablet',
          name: 'tablet',
          width: 768,
          height: 1024,
        },
        {
          label: 'Desktop',
          name: 'desktop',
          width: 1440,
          height: 900,
        },
      ],
    },
  },
  // This config helps us configure global or default features that the other editors can inherit
  editor: defaultLexical,
  db: postgresAdapter({
    // Keep schema push disabled by default so all shared schema changes flow through migrations.
    // Opt in only for throwaway local experiments with PAYLOAD_DB_PUSH=true.
    push: isDbPushEnabled,
    pool: {
      connectionString: process.env.DATABASE_URI || '',
    },
  }),
  collections: [
    Pages,
    Posts,
    PlatformContentMedia,
    ClinicMedia,
    ClinicGalleryMedia,
    ClinicGalleryEntries,
    DoctorMedia,
    UserProfileMedia,
    Categories,
    BasicUsers,
    Patients,
    ClinicStaff,
    PlatformStaff,
    ClinicApplications,
    PatientClinicInquiries,
    Clinics,
    Doctors,
    Accreditation,
    MedicalSpecialties,
    Treatments,
    ClinicTreatments,
    DoctorTreatments,
    DoctorSpecialties,
    FavoriteClinics,
    Reviews,
    Countries,
    Cities,
    Tags,
  ],
  cors: [getServerSideURL()].filter(Boolean),
  email: shouldUseSilentEmailAdapter ? silentEmailAdapter : undefined,
  globals: [Header, Footer, CookieConsent, LandingPages],
  localization: {
    locales: [
      {
        code: CONTENT_LOCALES[0],
        label: 'English',
      },
      {
        code: CONTENT_LOCALES[1],
        label: 'German',
      },
    ],
    defaultLocale: DEFAULT_CONTENT_LOCALE,
    fallback: true,
  },
  plugins: [...plugins],
  secret: process.env.PAYLOAD_SECRET,
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  jobs: {
    access: {
      run: canRunPayloadJobs,
    },
    enableConcurrencyControl: true,
    tasks: [seedChunkTask],
  },
  logger: createPayloadLoggerConfig(process.env),
  onInit: async (payload) => {
    if (process.env.NEXT_PHASE === 'phase-production-build' || process.env.CI === 'true') {
      return
    }

    await ensureManagedLegalContent(payload)
  },
})
