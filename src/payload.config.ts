// storage-adapter-import-placeholder
import { postgresAdapter } from '@payloadcms/db-postgres'

import sharp from 'sharp'
import path from 'path'
import { buildConfig, PayloadRequest, PayloadHandler } from 'payload'
import pino from 'pino'
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
  endpoints: [
    {
      path: '/seed',
      method: 'post',
      handler: (async (req: PayloadRequest, res: any) => {
        const payloadInstance = req.payload
        const start = Date.now()
        const type = (req.query.type as string) || 'baseline'
        const reset = req.query.reset === '1'
        try {
          // Access control (platform staff only)
          if (!req.user || (req.user as any).userType !== 'platform') {
            return res.status(403).json({ error: 'Forbidden' })
          }
          if (process.env.NODE_ENV === 'production' && type !== 'baseline') {
            return res.status(400).json({ error: 'Demo seeding disabled in production' })
          }
          const { runBaselineSeeds } = await import('./endpoints/seed/baseline')
          const { runDemoSeeds } = await import('./endpoints/seed/demo')
          let results
          if (type === 'baseline') {
            results = await runBaselineSeeds(payloadInstance)
          } else if (type === 'demo') {
            results = await runDemoSeeds(payloadInstance, { reset })
          } else {
            return res.status(400).json({ error: 'Invalid type parameter' })
          }
          const summary = {
            type,
            reset,
            startedAt: new Date(start).toISOString(),
            finishedAt: new Date().toISOString(),
            durationMs: Date.now() - start,
            totals: {
              created: results.reduce((a: number, r: any) => a + r.created, 0),
              updated: results.reduce((a: number, r: any) => a + r.updated, 0),
            },
            units: results,
          }
          ;(global as any).__lastSeedRun = summary
          return res.json(summary)
        } catch (e: any) {
          payloadInstance.logger.error(`Seed endpoint error: ${e.message}`)
          return res.status(500).json({ error: 'Seed failed', detail: e.message })
        }
      }) as PayloadHandler,
    },
    {
      path: '/seed',
      method: 'get',
      handler: (async (req: PayloadRequest, res: any) => {
        if (!req.user || (req.user as any).userType !== 'platform') {
          return res.status(403).json({ error: 'Forbidden' })
        }
        return res.json((global as any).__lastSeedRun || { message: 'No seed run yet' })
      }) as PayloadHandler,
    },
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
  logger: pino({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    name: 'findmydoc',
  }),
})
