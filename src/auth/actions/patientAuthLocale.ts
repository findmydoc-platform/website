import { z } from 'zod'

export const patientAuthLocales = ['de', 'en'] as const
export const patientAuthLocaleSchema = z.enum(patientAuthLocales)
export type PatientAuthLocale = z.infer<typeof patientAuthLocaleSchema>
