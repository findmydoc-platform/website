import { mcpPlugin } from '@payloadcms/plugin-mcp'
import { UnauthorizedError, type CollectionSlug, type Plugin } from 'payload'
import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'

type McpCollectionConfig = {
  description: string
  enabled: {
    find: boolean
    create: boolean
    update: boolean
    delete: boolean
  }
}

const mcpUserCollection: CollectionSlug = 'basicUsers'

const mcpReadCollections = [
  'pages',
  'posts',
  'clinics',
  'doctors',
  'treatments',
  'medical-specialties',
  'accreditation',
  'categories',
  'tags',
  'countries',
  'cities',
  'clinictreatments',
  'doctortreatments',
  'doctorspecialties',
  'reviews',
  'clinicGalleryEntries',
] as const

// Note: Collections that contain `point` fields (e.g., `cities`, `clinics`) are intentionally
// not exposed as writable via MCP because the generated tuple/array schema (e.g. [number, number])
// is not valid for MCP function input parameters. Keep writable collection list to safe types only.
// issue: https://github.com/payloadcms/payload/issues/15287
const mcpWriteCollections = new Set<string>([
  'tags',
  'accreditation',
  'categories',
  'medical-specialties',
  'treatments',
  'countries',
])

const mcpCollectionDescriptions: Record<(typeof mcpReadCollections)[number], string> = {
  pages: 'Published pages and structured content for the website.',
  posts: 'Editorial posts and long-form articles.',
  clinics: 'Clinic profiles and directory listings.',
  doctors: 'Doctor profiles linked to clinics and specialties.',
  treatments: 'Treatment catalog entries used by clinics and doctors.',
  'medical-specialties': 'Medical specialty taxonomy for discovery and filtering.',
  accreditation: 'Accreditation references for clinics and doctors.',
  categories: 'Content categories for organizing posts and pages.',
  tags: 'Content tags used for discovery and metadata.',
  countries: 'Country reference data for locations.',
  cities: 'City reference data for locations.',
  clinictreatments: 'Clinic-to-treatment offerings with pricing details.',
  doctortreatments: 'Doctor-to-treatment offerings.',
  doctorspecialties: 'Doctor-to-specialty relationships.',
  reviews: 'Approved patient reviews and ratings.',
  clinicGalleryEntries: 'Curated clinic gallery entries and captions.',
}

const mcpCollections = mcpReadCollections.reduce<Record<string, McpCollectionConfig>>((acc, slug) => {
  const writable = mcpWriteCollections.has(slug)
  acc[slug] = {
    description: mcpCollectionDescriptions[slug],
    enabled: {
      find: true,
      create: writable,
      update: writable,
      delete: false,
    },
  }
  return acc
}, {})

export const createMcpPlugin = (): Plugin =>
  mcpPlugin({
    collections: mcpCollections,
    userCollection: mcpUserCollection,

    overrideApiKeyCollection: (collection) => {
      return {
        ...collection,
        access: {
          ...collection.access,
          create: isPlatformBasicUser,
          read: isPlatformBasicUser,
          update: isPlatformBasicUser,
          delete: isPlatformBasicUser,
        },
      }
    },

    overrideAuth: async (_req, getDefaultMcpAccessSettings) => {
      const mcpAccessSettings = await getDefaultMcpAccessSettings()

      const isPlatformStaffUser = (user: unknown): boolean => {
        if (typeof user !== 'object' || user === null) return false
        const record = user as Record<string, unknown>
        return record.collection === mcpUserCollection && record.userType === 'platform'
      }

      if (!isPlatformStaffUser(mcpAccessSettings.user as unknown)) {
        throw new UnauthorizedError()
      }

      return mcpAccessSettings
    },
  })
