import type { MCPAccessSettings } from '@payloadcms/plugin-mcp'
import { APIError, type Field, type PayloadRequest } from 'payload'
import { z } from 'zod'
import { isValidEmail, normalizeEmail } from '@/auth/utilities/emailNormalization'
import {
  correctClinicOnboarding,
  McpOnboardingError,
  readClinicOnboarding,
  stageClinicOnboarding,
} from '@/features/clinicOnboarding/stagedApplication'

const clinicOnboardingGrants = {
  read: { tool: 'readClinicOnboarding', label: { en: 'Read applications', de: 'Vorgänge lesen' } },
  create: { tool: 'stageClinicOnboarding', label: { en: 'Stage an application', de: 'Vorgang anlegen' } },
  correct: {
    tool: 'correctClinicOnboarding',
    label: { en: 'Correct an open application', de: 'Offenen Vorgang korrigieren' },
  },
} as const

type ClinicOnboardingGrant = keyof typeof clinicOnboardingGrants
const onboardingGrantEntries = Object.entries(clinicOnboardingGrants) as [
  ClinicOnboardingGrant,
  (typeof clinicOnboardingGrants)[ClinicOnboardingGrant],
][]
const permissions = new WeakMap<PayloadRequest, Set<ClinicOnboardingGrant>>()

export function mapClinicOnboardingGrants(req: PayloadRequest, settings: MCPAccessSettings) {
  const values = settings.clinicOnboarding as Record<string, unknown> | undefined
  const active = new Set(onboardingGrantEntries.filter(([grant]) => values?.[grant] === true).map(([grant]) => grant))
  permissions.set(req, active)
  return {
    ...settings,
    'payload-mcp-tool': {
      ...settings['payload-mcp-tool'],
      ...Object.fromEntries(onboardingGrantEntries.map(([grant, { tool }]) => [tool, active.has(grant)])),
    },
  }
}

export function groupClinicOnboardingGrants(fields: Field[]): Field[] {
  const toolNames = new Set<string>(onboardingGrantEntries.map(([, { tool }]) => tool))
  return fields.map((field) => {
    if (field.type !== 'collapsible') return field
    const clinicCapabilities = field.fields.find(
      (nested) => nested.type === 'group' && 'name' in nested && nested.name === 'clinics',
    )
    if (clinicCapabilities) {
      return {
        ...field,
        label: { en: 'Clinic profiles', de: 'Klinikprofile' },
        admin: { ...field.admin, initCollapsed: true },
        fields: [
          {
            type: 'collapsible',
            label: { en: 'Onboarding', de: 'Onboarding' },
            fields: [
              {
                type: 'group',
                name: 'clinicOnboarding',
                label: false,
                fields: onboardingGrantEntries.map(([name, { label }]) => ({
                  name,
                  label,
                  type: 'checkbox',
                  defaultValue: false,
                })),
              },
            ],
          },
          { type: 'collapsible', label: { en: 'Profile care', de: 'Profilpflege' }, fields: field.fields },
        ],
      }
    }
    return {
      ...field,
      fields: field.fields.map((nested) =>
        nested.type === 'group' && 'name' in nested && nested.name === 'payload-mcp-tool'
          ? {
              ...nested,
              fields: nested.fields
                .filter((item) => item.type !== 'checkbox' || !toolNames.has(item.name))
                .map((item) => (item.type === 'checkbox' ? { ...item, defaultValue: false } : item)),
            }
          : nested,
      ),
    }
  })
}

const id = z.number().int().positive().safe()
const requiredText = z.string().trim().min(1).max(200)
const website = z
  .string()
  .trim()
  .max(2_048)
  .url()
  .refine((value) => {
    const parsed = URL.parse(value)
    return parsed && ['https:', 'http:'].includes(parsed.protocol) && parsed.hostname.includes('.')
  }, 'Enter a valid clinic website URL.')
const contactEmail = z.string().max(254).transform(normalizeEmail).refine(isValidEmail, 'Enter a valid email address.')
const intake = z.object({
  clinicName: requiredText,
  clinicWebsite: website,
  medicalSpecialtyIds: z.array(id).min(1).max(100),
  contactFirstName: requiredText,
  contactLastName: requiredText,
  contactEmail,
  contactRole: z.enum(['Medical Director', 'Clinic Management', 'International Office']),
})
const applicationIdInput = z.object({ applicationId: id })
const correctionInput = intake.partial().merge(applicationIdInput)
const stageInput = intake.extend({ requestKey: z.string().trim().min(1).max(200), staffMode: z.literal('new_account') })

function defineOnboardingTool<Shape extends z.ZodRawShape>(
  grant: ClinicOnboardingGrant,
  description: string,
  input: z.ZodObject<Shape>,
  run: (req: PayloadRequest, args: z.infer<z.ZodObject<Shape>>) => Promise<unknown>,
) {
  return {
    name: clinicOnboardingGrants[grant].tool,
    description,
    parameters: input.shape,
    handler: async (args: Record<string, unknown>, req: PayloadRequest) => {
      if (!permissions.get(req)?.has(grant)) throw new APIError('Clinic onboarding grant is required.', 403)
      const parsed = input.parse(args)
      try {
        const result = await run(req, parsed)
        return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] }
      } catch (error) {
        if (error instanceof McpOnboardingError) throw error
        if (error instanceof APIError && error.status === 403)
          throw new APIError('Clinic onboarding access is denied.', 403)
        throw new APIError('The clinic onboarding operation could not be completed.', 409)
      }
    },
  }
}

export const clinicOnboardingTools = [
  defineOnboardingTool(
    'read',
    'Read a staged clinic onboarding application and its current statuses.',
    applicationIdInput,
    readClinicOnboarding,
  ),
  defineOnboardingTool(
    'create',
    'Stage a pending clinic application, unpublished clinic and new first staff account. Reuse the request key when retrying.',
    stageInput,
    stageClinicOnboarding,
  ),
  defineOnboardingTool(
    'correct',
    'Correct supplied details of an open new-account clinic onboarding application.',
    correctionInput,
    (req, { applicationId, ...details }) => {
      if (!Object.values(details).some((value) => value !== undefined)) {
        throw new McpOnboardingError('Provide at least one detail to correct.', 400)
      }
      return correctClinicOnboarding(req, { applicationId, ...details })
    },
  ),
]
