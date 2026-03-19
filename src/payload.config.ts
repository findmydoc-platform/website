// storage-adapter-import-placeholder
import { postgresAdapter } from '@payloadcms/db-postgres'

import sharp from 'sharp'
import path from 'path'
import { buildConfig, PayloadRequest, PayloadHandler } from 'payload'
import { seedPostHandler, seedGetHandler, seedAdvanceHandler, seedRetryHandler } from './endpoints/seed/seedEndpoint'
import { seedChunkTask } from './endpoints/seed/tasks/seedChunkTask'
import { fileURLToPath } from 'url'
import { config as dotenvConfig } from 'dotenv'
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
import { Header } from './globals/Header/config'
import { ensureManagedLegalContent } from './collections/Pages/legalPages'

// Import Plugins & Utilities
import { plugins } from './plugins'
import { defaultLexical } from '@/fields/defaultLexical'
import { getServerSideURL } from './utilities/getURL'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const adminDashboardConfig = createAdminDashboardConfig(process.env)

// Load only when running tests
if (process.env.NODE_ENV === 'test') {
  dotenvConfig({ path: path.resolve(dirname, '../.env.test') })
}

const isDbPushEnabled = process.env.PAYLOAD_DB_PUSH === 'true' && process.env.NODE_ENV !== 'test'

export default buildConfig({
  // Global upload constraints (Busboy limits). 5MB per file to keep tenant assets lightweight.
  // Can be raised later via env-driven config if needed.
  upload: {
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB
    },
    abortOnLimit: true,
    responseOnLimit: 'File size limit exceeded (5MB)',
    safeFileNames: true,
  },
  endpoints: [
    { path: '/seed', method: 'post', handler: seedPostHandler as PayloadHandler },
    { path: '/seed', method: 'get', handler: seedGetHandler as PayloadHandler },
    { path: '/seed/retry', method: 'post', handler: seedRetryHandler as PayloadHandler },
    { path: '/seed/advance', method: 'get', handler: seedAdvanceHandler as PayloadHandler },
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
      createFirstUser: '/first-admin',
      logout: '/logout',
    },
    avatar: {
      Component: '@/components/organisms/AdminBranding/AdminAccountAvatar',
    },
    theme: 'light',
    user: BasicUsers.slug,
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
  globals: [Header, Footer],
  plugins: [...plugins],
  secret: process.env.PAYLOAD_SECRET,
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  jobs: {
    access: {
      run: ({ req }: { req: PayloadRequest }): boolean => {
        // Allow logged in users to execute this endpoint (default)
        if (req.user) return true

        // If there is no logged in user, then check for the Vercel Cron secret
        const authHeader = req.headers.get('authorization')
        return authHeader === `Bearer ${process.env.CRON_SECRET}`
      },
    },
    enableConcurrencyControl: true,
    tasks: [seedChunkTask],
  },
  logger: createPayloadLoggerConfig(process.env),
  onInit: async (payload) => {
    await ensureManagedLegalContent(payload)
  },
})
