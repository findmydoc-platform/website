import type { PayloadRequest } from 'payload'
import { z } from 'zod'
import { openingHoursDayNames } from '@/collections/clinics/openingHours'
import { requireCurrentPlatformStaff } from '@/access/requireCurrentPlatformStaff'
import type { ClinicsSelect } from '@/payload-types'

const documentId = z.number().int().positive().safe()
const nullableText = z.string().nullable().optional()
const openingHoursDay = z.strictObject({
  isClosed: z.boolean(),
  opensAt: nullableText,
  closesAt: nullableText,
})
const description = z.looseObject({
  root: z.looseObject({
    type: z.literal('root'),
    children: z.array(z.looseObject({ type: z.string(), version: z.number() })),
    direction: z.enum(['ltr', 'rtl']).nullable(),
    format: z.enum(['left', 'start', 'center', 'right', 'end', 'justify', '']),
    indent: z.number(),
    version: z.number(),
  }),
})

const clinicProfile = z.strictObject({
  description: description.nullable().optional(),
  address: z
    .strictObject({
      country: documentId.nullable().optional(),
      city: documentId.nullable().optional(),
      street: nullableText,
      houseNumber: nullableText,
      zipCode: nullableText,
    })
    .optional(),
  contact: z.strictObject({ email: nullableText, phoneNumber: nullableText, website: nullableText }).optional(),
  openingHours: z.record(z.enum(openingHoursDayNames), openingHoursDay).optional(),
})

const readInput = z.strictObject({ clinicId: documentId })
const updateInput = z.strictObject({ clinicId: documentId, profile: clinicProfile })

const select = {
  name: true,
  slug: true,
  description: true,
  address: true,
  contact: true,
  openingHours: true,
  status: true,
} as const satisfies ClinicsSelect

// The MCP SDK accepts strict object schemas. Payload's custom tool type declares raw shapes only.
const toolParameters = (schema: z.ZodObject): z.ZodRawShape => schema as unknown as z.ZodRawShape

const profileResult = (profile: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(profile) }] })

export const readClinicProfile = {
  name: 'readClinicProfile',
  description:
    'Read the public-facing profile fields and publication status for one clinic, including unpublished clinics.',
  parameters: toolParameters(readInput),
  handler: async (args: Record<string, unknown>, req: PayloadRequest) => {
    const { clinicId } = readInput.parse(args)
    await requireCurrentPlatformStaff(req)
    return profileResult(
      await req.payload.findByID({ collection: 'clinics', id: clinicId, depth: 0, select, overrideAccess: false, req }),
    )
  },
}

export const updateClinicProfile = {
  name: 'updateClinicProfile',
  description: 'Edit a clinic description, address, opening hours, website, or public contact details.',
  parameters: toolParameters(updateInput),
  handler: async (args: Record<string, unknown>, req: PayloadRequest) => {
    const { clinicId, profile } = updateInput.parse(args)
    await requireCurrentPlatformStaff(req)
    return profileResult(
      await req.payload.update({
        collection: 'clinics',
        id: clinicId,
        data: profile,
        depth: 0,
        select,
        overrideAccess: false,
        req,
      }),
    )
  },
}
