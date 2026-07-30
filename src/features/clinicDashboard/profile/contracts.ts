import { z } from 'zod'

export const clinicProfileSupportedLanguageValues = [
  'german',
  'english',
  'french',
  'spanish',
  'italian',
  'turkish',
  'russian',
  'arabic',
  'chinese',
  'japanese',
  'korean',
  'portuguese',
] as const

export const clinicProfileWeekdayValues = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const

export const clinicProfileCountry = {
  code: 'TR',
  name: 'Türkiye',
} as const

export const clinicProfileSourceFieldLimits = {
  cityNameLength: 160,
  descriptionTextLength: 10_000,
  houseNumberLength: 40,
  nameLength: 180,
  streetLength: 200,
  zipCodeLength: 32,
} as const

const relationshipIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/u)
const timeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$|^$/u)
const openingHoursDaySchema = z
  .object({
    closesAt: timeSchema,
    isClosed: z.boolean(),
    opensAt: timeSchema,
  })
  .strict()
const openingHoursSchema = z
  .object({
    friday: openingHoursDaySchema,
    monday: openingHoursDaySchema,
    saturday: openingHoursDaySchema,
    sunday: openingHoursDaySchema,
    thursday: openingHoursDaySchema,
    tuesday: openingHoursDaySchema,
    wednesday: openingHoursDaySchema,
  })
  .strict()
  .superRefine((openingHours, context) => {
    for (const weekday of clinicProfileWeekdayValues) {
      const day = openingHours[weekday]
      if (day.isClosed && (day.opensAt !== '' || day.closesAt !== '')) {
        context.addIssue({
          code: 'custom',
          message: 'Closed days must not contain times',
          path: [weekday],
        })
      }
    }
  })
const supportedLanguagesSchema = z
  .array(z.enum(clinicProfileSupportedLanguageValues))
  .max(clinicProfileSupportedLanguageValues.length)
  .refine((languages) => new Set(languages).size === languages.length)
const draftInputSchema = z
  .object({
    address: z
      .object({
        cityId: relationshipIdSchema.optional(),
        houseNumber: z.string().max(clinicProfileSourceFieldLimits.houseNumberLength),
        street: z.string().max(clinicProfileSourceFieldLimits.streetLength),
        zipCode: z.string().max(clinicProfileSourceFieldLimits.zipCodeLength),
      })
      .strict(),
    descriptionText: z.string().max(clinicProfileSourceFieldLimits.descriptionTextLength),
    name: z.string().max(clinicProfileSourceFieldLimits.nameLength),
    openingHours: openingHoursSchema.optional(),
    supportedLanguages: supportedLanguagesSchema,
  })
  .strict()
const revisionSchema = z.number().int().nonnegative()

export const clinicProfileDraftCreateInputSchema = z
  .object({
    expectedPublishedRevision: revisionSchema,
  })
  .strict()

export const clinicProfileDraftSaveInputSchema = z
  .object({
    draft: draftInputSchema,
    expectedDraftRevision: revisionSchema,
    expectedPublishedRevision: revisionSchema,
  })
  .strict()

export const clinicProfileDraftDiscardInputSchema = z
  .object({
    expectedDraftRevision: revisionSchema,
  })
  .strict()

export const clinicProfilePublishInputSchema = z
  .object({
    expectedDraftRevision: revisionSchema,
    expectedPublishedRevision: revisionSchema,
  })
  .strict()

export type ClinicProfileDraftCreateInput = z.infer<typeof clinicProfileDraftCreateInputSchema>
export type ClinicProfileDraftSaveInput = z.infer<typeof clinicProfileDraftSaveInputSchema>
export type ClinicProfileDraftDiscardInput = z.infer<typeof clinicProfileDraftDiscardInputSchema>
export type ClinicProfilePublishInput = z.infer<typeof clinicProfilePublishInputSchema>
export type ClinicProfileOpeningHours = z.infer<typeof openingHoursSchema>
export type ClinicProfileSupportedLanguage = (typeof clinicProfileSupportedLanguageValues)[number]

export type ClinicProfileCityDTO = {
  id: string
  name: string
}

export type ClinicProfileSourceFieldsDTO = {
  address: {
    city?: ClinicProfileCityDTO
    country: typeof clinicProfileCountry
    houseNumber: string
    street: string
    zipCode: string
  }
  descriptionText: string
  name: string
  openingHours?: ClinicProfileOpeningHours
  supportedLanguages: ClinicProfileSupportedLanguage[]
}

export type ClinicProfileSnapshotDTO = {
  availableCities: ClinicProfileCityDTO[]
  draft?: ClinicProfileSourceFieldsDTO & {
    basePublishedRevision: number
    revision: number
  }
  published: ClinicProfileSourceFieldsDTO & {
    revision: number
  }
}
