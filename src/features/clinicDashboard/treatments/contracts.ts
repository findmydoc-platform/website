import { z } from 'zod'

const identifierSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/u)
const priceEURSchema = z
  .number()
  .finite()
  .nonnegative()
  .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) <= 1e-8)
const revisionSchema = z.string().datetime({ offset: true })

export const clinicTreatmentCreateInputSchema = z
  .object({
    priceEUR: priceEURSchema,
    treatmentId: identifierSchema,
  })
  .strict()

export const clinicTreatmentUpdateInputSchema = z
  .object({
    active: z.boolean(),
    expectedRevision: revisionSchema,
    offeringId: identifierSchema,
    priceEUR: priceEURSchema,
  })
  .strict()

export type ClinicTreatmentCreateInput = z.infer<typeof clinicTreatmentCreateInputSchema>
export type ClinicTreatmentUpdateInput = z.infer<typeof clinicTreatmentUpdateInputSchema>

export type ClinicTreatmentMasterDTO = {
  descriptionText: string
  id: string
  name: string
}

export type ClinicTreatmentOfferingDTO = {
  active: boolean
  id: string
  priceEUR: number
  revision: string
  treatment: ClinicTreatmentMasterDTO
}

export type ClinicTreatmentSnapshotDTO = {
  catalogue: ClinicTreatmentMasterDTO[]
  offerings: ClinicTreatmentOfferingDTO[]
}
