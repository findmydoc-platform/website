import { mcpPlugin } from '@payloadcms/plugin-mcp'
import { APIError, UnauthorizedError, type CollectionSlug, type Payload, type Plugin } from 'payload'
import { z } from 'zod'
import { isPlatformAdminUser } from '@/access/isPlatformAdmin'
import { withAuthorizedMcpTrash } from '@/access/mcpTrashAccess'
import { generatedCollectionAccess } from '@/security/generatedCollectionAccess'
import {
  appendPlatformClinicGalleryMedia,
  readPlatformClinicGallery,
  requireCurrentPlatformStaff,
  savePlatformClinicGallery,
} from '@/features/clinicDashboard/gallery/platformGallery'
import { clinicGallerySaveInputSchema } from '@/features/clinicDashboard/gallery/contracts'
import { clinicProfileMediaImageMimeTypes, standardMediaImageMimeTypes } from '@/collections/common/mediaCollection'
import { MEDIA_UPLOAD_MAX_BYTES } from '@/config/mediaUploadPolicy'
import { relationId } from '@/collections/clinics/profileGallery'
import type { ClinicMedia, DoctorMedia } from '@/payload-types'

type McpCollectionConfig = {
  description: string
  createOptionalFields?: string[]
  enabled: {
    find: boolean
    create: boolean
    update: boolean
    delete: boolean
  }
}

const mcpUserCollection: CollectionSlug = 'platformStaff'

export const isPlatformStaffMcpUser = (user: unknown): boolean => {
  if (typeof user !== 'object' || user === null) return false
  return (user as Record<string, unknown>).collection === mcpUserCollection
}

export const mcpReadCollectionSlugs = [
  'pages',
  'posts',
  'clinics',
  'clinicGroups',
  'doctors',
  'clinicMedia',
  'doctorMedia',
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
] as const

const mcpWriteCollections = new Set<string>([
  'clinics',
  'doctors',
  'clinictreatments',
  'doctortreatments',
  'doctorspecialties',
  'posts',
  'tags',
  'accreditation',
  'categories',
  'medical-specialties',
  'treatments',
  'countries',
])

const mcpCollectionDescriptions: Record<(typeof mcpReadCollectionSlugs)[number], string> = {
  pages: 'Published pages and structured content for the website.',
  posts: 'Editorial posts and long-form articles.',
  clinics: 'Clinic profiles and directory listings.',
  clinicGroups: 'Clinic groups available for assignment during profile creation.',
  doctors: 'Doctor profiles linked to clinics and specialties.',
  clinicMedia: 'Clinic-owned images and their metadata.',
  doctorMedia: 'Doctor-owned images and their metadata.',
  treatments: 'Treatment catalog entries used by clinics and doctors.',
  'medical-specialties': 'Medical specialty taxonomy for discovery and filtering.',
  accreditation: 'Accreditation references for clinics and doctors.',
  categories: 'Content categories for organizing posts and pages.',
  tags: 'Content tags used for discovery and metadata.',
  countries: 'Country reference data for locations.',
  cities: 'City reference data for locations.',
  clinictreatments: 'Clinic-to-treatment offerings with EUR pricing and public activation status.',
  doctortreatments: 'Doctor-to-treatment offerings.',
  doctorspecialties: 'Doctor-to-specialty relationships.',
  reviews: 'Approved patient reviews and ratings.',
}

const mcpCollections = mcpReadCollectionSlugs.reduce<Record<string, McpCollectionConfig>>((acc, slug) => {
  const writable = mcpWriteCollections.has(slug)
  acc[slug] = {
    description: mcpCollectionDescriptions[slug],
    // The plugin patch lets Payload generate these required fields during creation.
    ...(slug === 'clinics' || slug === 'doctors' ? { createOptionalFields: ['slug'] } : {}),
    enabled: {
      find: true,
      create: writable,
      update: writable,
      delete: false,
    },
  }
  return acc
}, {})

const createTrashTool = (collection: 'clinics' | 'doctors', name: string, label: string) => ({
  name,
  description: `Move one ${label} to the trash using the current staff member’s access rights.`,
  parameters: { id: z.union([z.string().min(1), z.number().int().positive()]) },
  handler: async (args: Record<string, unknown>, req: import('payload').PayloadRequest) => {
    const id = args.id
    if (typeof id !== 'string' && typeof id !== 'number') throw new Error(`Invalid ${label} ID`)
    await withAuthorizedMcpTrash(req, () =>
      req.payload.update({
        collection,
        id,
        data: { deletedAt: new Date().toISOString() },
        overrideAccess: false,
        req,
        user: req.user,
      }),
    )
    return { content: [{ type: 'text' as const, text: `${label} ${id} moved to trash.` }] }
  },
})

const createDeleteLinkTool = (
  collection: 'clinictreatments' | 'doctortreatments' | 'doctorspecialties',
  name: string,
  label: string,
) => ({
  name,
  description: `Delete one ${label} link using the current staff member’s access rights.`,
  parameters: { id: z.union([z.string().min(1), z.number().int().positive()]) },
  handler: async (args: Record<string, unknown>, req: import('payload').PayloadRequest) => {
    const id = args.id
    if (typeof id !== 'string' && typeof id !== 'number') throw new Error(`Invalid ${label} ID`)
    await req.payload.delete({ collection, id, overrideAccess: false, req, user: req.user })
    return { content: [{ type: 'text' as const, text: `${label} link ${id} deleted.` }] }
  },
})

const publishClinicGalleryImage = {
  name: 'publishClinicGalleryImage',
  description: 'Add one owned clinic image to its clinic profile gallery.',
  parameters: { mediaId: z.number().int().positive() },
  handler: async (args: Record<string, unknown>, req: import('payload').PayloadRequest) => {
    if (typeof args.mediaId !== 'number' || !Number.isSafeInteger(args.mediaId) || args.mediaId <= 0) {
      throw new Error('Invalid image ID')
    }
    const snapshot = await appendPlatformClinicGalleryMedia(req, args.mediaId)
    return { content: [{ type: 'text' as const, text: JSON.stringify(snapshot) }] }
  },
}

const uploadClinicGalleryImageSchema = z.object({
  clinicId: z.number().int().positive().safe(),
  name: z
    .string()
    .min(1)
    .max(128)
    .refine(
      (name) => ![...name].some((char) => char === '/' || char === String.fromCharCode(92) || char.charCodeAt(0) < 32),
    ),
  mimeType: z.enum(clinicProfileMediaImageMimeTypes as [string, ...string[]]),
  base64: z
    .string()
    .min(4)
    .max(Math.ceil(MEDIA_UPLOAD_MAX_BYTES / 3) * 4)
    .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u),
  alt: z.string().trim().max(2_000).optional(),
})

const uploadClinicGalleryImage = {
  name: 'uploadClinicGalleryImage',
  description: 'Upload a clinic-owned draft image for its profile gallery.',
  parameters: uploadClinicGalleryImageSchema.shape,
  handler: async (args: Record<string, unknown>, req: import('payload').PayloadRequest) => {
    const input = uploadClinicGalleryImageSchema.parse(args)
    const data = Buffer.from(input.base64, 'base64')
    if (!data.length || data.length > MEDIA_UPLOAD_MAX_BYTES) throw new APIError('Invalid image size.', 413)
    await requireCurrentPlatformStaff(req)
    await req.payload.findByID({ collection: 'clinics', id: input.clinicId, depth: 0, overrideAccess: false, req })
    const media = (await req.payload.create({
      collection: 'clinicMedia',
      context: { clinicGalleryUpload: true },
      data: { clinic: input.clinicId, ...(input.alt ? { alt: input.alt } : {}) },
      file: { name: input.name, mimetype: input.mimeType, size: data.length, data },
      overrideAccess: false,
      req,
      user: req.user,
    } as Parameters<Payload['create']>[0])) as ClinicMedia
    return { content: [{ type: 'text' as const, text: JSON.stringify({ id: media.id, status: media.status }) }] }
  },
}

const uploadDoctorImageSchema = uploadClinicGalleryImageSchema.omit({ clinicId: true, alt: true }).extend({
  doctorId: z.number().int().positive().safe(),
  mimeType: z.enum(standardMediaImageMimeTypes as [string, ...string[]]),
  alt: z.string().trim().min(1).max(2_000),
})

const uploadDoctorImage = {
  name: 'uploadDoctorImage',
  description: 'Upload an image owned by one doctor.',
  parameters: uploadDoctorImageSchema.shape,
  handler: async (args: Record<string, unknown>, req: import('payload').PayloadRequest) => {
    const input = uploadDoctorImageSchema.parse(args)
    const data = Buffer.from(input.base64, 'base64')
    if (!data.length || data.length > MEDIA_UPLOAD_MAX_BYTES) throw new APIError('Invalid image size.', 413)
    await requireCurrentPlatformStaff(req)
    const doctor = await req.payload.findByID({
      collection: 'doctors',
      id: input.doctorId,
      depth: 0,
      overrideAccess: false,
      req,
    })
    const clinicId = relationId(doctor.clinic)
    if (typeof clinicId !== 'number') throw new APIError('The doctor has no clinic.', 422)
    const media = (await req.payload.create({
      collection: 'doctorMedia',
      data: { doctor: input.doctorId, clinic: clinicId, alt: input.alt },
      file: { name: input.name, mimetype: input.mimeType, size: data.length, data },
      overrideAccess: false,
      req,
      user: req.user,
    } as Parameters<Payload['create']>[0])) as DoctorMedia
    return { content: [{ type: 'text' as const, text: JSON.stringify({ id: media.id }) }] }
  },
}

const updateDoctorImage = {
  name: 'updateDoctorImage',
  description: 'Update the alternative text of a doctor-owned image.',
  parameters: { id: z.number().int().positive().safe(), alt: z.string().trim().min(1).max(2_000) },
  handler: async (args: Record<string, unknown>, req: import('payload').PayloadRequest) => {
    const id = z.number().int().positive().safe().parse(args.id)
    const alt = z.string().trim().min(1).max(2_000).parse(args.alt)
    await requireCurrentPlatformStaff(req)
    const media = await req.payload.update({ collection: 'doctorMedia', id, data: { alt }, overrideAccess: false, req })
    return { content: [{ type: 'text' as const, text: JSON.stringify({ id: media.id, alt: media.alt }) }] }
  },
}

const createDeleteMediaTool = (collection: 'clinicMedia' | 'doctorMedia', name: string) => ({
  name,
  description: 'Permanently delete one unreferenced image using the current staff member’s access rights.',
  parameters: { id: z.number().int().positive().safe() },
  handler: async (args: Record<string, unknown>, req: import('payload').PayloadRequest) => {
    const id = z.number().int().positive().safe().parse(args.id)
    await requireCurrentPlatformStaff(req)
    await req.payload.delete({ collection, id, overrideAccess: false, req })
    return { content: [{ type: 'text' as const, text: `Image ${id} deleted.` }] }
  },
})

const readClinicGallery = {
  name: 'readClinicGallery',
  description: 'Read the current ordered gallery and revision for a clinic.',
  parameters: { clinicId: z.number().int().positive().safe() },
  handler: async (args: Record<string, unknown>, req: import('payload').PayloadRequest) => {
    const clinicId = z.number().int().positive().safe().parse(args.clinicId)
    const snapshot = await readPlatformClinicGallery(req, clinicId)
    return { content: [{ type: 'text' as const, text: JSON.stringify(snapshot) }] }
  },
}

const saveClinicGalleryTool = {
  name: 'saveClinicGallery',
  description: 'Save the ordered clinic gallery using its current revision.',
  parameters: { clinicId: z.number().int().positive().safe(), ...clinicGallerySaveInputSchema.shape },
  handler: async (args: Record<string, unknown>, req: import('payload').PayloadRequest) => {
    const clinicId = z.number().int().positive().safe().parse(args.clinicId)
    const input = clinicGallerySaveInputSchema.parse({ expectedRevision: args.expectedRevision, items: args.items })
    const snapshot = await savePlatformClinicGallery(req, clinicId, input)
    return { content: [{ type: 'text' as const, text: JSON.stringify(snapshot) }] }
  },
}

export const createMcpPlugin = (): Plugin =>
  mcpPlugin({
    collections: mcpCollections,
    userCollection: mcpUserCollection,
    mcp: {
      tools: [
        createTrashTool('clinics', 'trashClinic', 'Clinic'),
        createTrashTool('doctors', 'trashDoctor', 'Doctor'),
        createDeleteLinkTool('clinictreatments', 'deleteClinicTreatment', 'Clinic treatment'),
        createDeleteLinkTool('doctortreatments', 'deleteDoctorTreatment', 'Doctor treatment'),
        createDeleteLinkTool('doctorspecialties', 'deleteDoctorSpecialty', 'Doctor specialty'),
        publishClinicGalleryImage,
        uploadClinicGalleryImage,
        uploadDoctorImage,
        updateDoctorImage,
        createDeleteMediaTool('clinicMedia', 'deleteClinicImage'),
        createDeleteMediaTool('doctorMedia', 'deleteDoctorImage'),
        readClinicGallery,
        saveClinicGalleryTool,
      ],
    },

    overrideApiKeyCollection: (collection) => {
      return {
        ...collection,
        fields: collection.fields.map((field) =>
          field.type === 'collapsible'
            ? {
                ...field,
                fields: field.fields.map((nested) =>
                  nested.type === 'group' && 'name' in nested && nested.name === 'payload-mcp-tool'
                    ? {
                        ...nested,
                        fields: nested.fields.map((item) =>
                          item.type === 'checkbox' ? { ...item, defaultValue: false } : item,
                        ),
                      }
                    : nested,
                ),
              }
            : field,
        ),
        admin: {
          ...collection.admin,
          hidden: ({ user }) => !isPlatformAdminUser(user),
        },
        access: {
          ...collection.access,
          ...generatedCollectionAccess['payload-mcp-api-keys'],
        },
      }
    },

    overrideAuth: async (_req, getDefaultMcpAccessSettings) => {
      const mcpAccessSettings = await getDefaultMcpAccessSettings()

      if (!isPlatformStaffMcpUser(mcpAccessSettings.user as unknown)) {
        throw new UnauthorizedError()
      }

      return mcpAccessSettings
    },
  })
