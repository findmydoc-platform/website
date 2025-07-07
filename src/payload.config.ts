// storage-adapter-import-placeholder
import { postgresAdapter } from '@payloadcms/db-postgres'

import sharp from 'sharp' // sharp-import
import path from 'path'
import { buildConfig, PayloadRequest } from 'payload'
import { fileURLToPath } from 'url'

// Import Collections
import { Categories } from './collections/Categories'
import { Media } from './collections/Media'
import { Pages } from './collections/Pages'
import { Posts } from './collections/Posts'
import { PlatformStaff } from './collections/PlatformStaff'
import { Clinics } from './collections/Clinics'
import { Doctors } from './collections/Doctors'
import { Accreditation } from './collections/Accredition'
import { MedicalSpecialties } from './collections/MedicalSpecialities'
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
    pool: {
      connectionString: process.env.DATABASE_URI || '',
    },
  }),
  collections: [
    Pages,
    Posts,
    Media,
    Categories,
    BasicUsers,
    Patients,
    ClinicStaff,
    PlatformStaff,
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
})
