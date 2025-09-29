// storage-adapter-import-placeholder
import { postgresAdapter } from '@payloadcms/db-postgres'

import sharp from 'sharp'
import path from 'path'
import { buildConfig, PayloadRequest, PayloadHandler } from 'payload'
import { seedPostHandler, seedGetHandler } from './endpoints/seed/seedEndpoint'
import { fileURLToPath } from 'url'

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

// Import Globals
import { Footer } from './Footer/config'
import { Header } from './Header/config'

// Import Plugins & Utilities
import { plugins } from './plugins'
import { defaultLexical } from '@/fields/defaultLexical'
import { getServerSideURL } from './utilities/getURL'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const beforeDashboardComponents =
  process.env.FEATURE_DEVELOPER_DASHBOARD === 'true' ? ['@/components/DeveloperDashboard'] : []

// Load only when running tests
if (process.env.NODE_ENV === 'test') {
  const { config } = await import('dotenv')
  config({ path: path.resolve(dirname, '../.env.test') })
}

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
  ],
  admin: {
    components: {
      beforeDashboard: beforeDashboardComponents,
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
    routes: {
      login: '/login',
      createFirstUser: '/first-admin',
      logout: '/logout',
    },
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
    // Disable dev schema push in test to rely solely on migrations and avoid constraint issues
    push: process.env.NODE_ENV === 'test' ? false : undefined,
    pool: {
      connectionString: process.env.DATABASE_URI || '',
    },
  }),
  collections: [
    Pages,
    Posts,
    PlatformContentMedia,
    ClinicMedia,
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
    tasks: [],
  },
  logger: {
    options: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      name: 'findmydoc',
    },
  },
})
