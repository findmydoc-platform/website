import type { MCPAccessSettings } from '@payloadcms/plugin-mcp'
import { APIError, type GroupField, type PayloadRequest } from 'payload'
import { z } from 'zod'
import { findEligibleClinicOnboardingStaff } from '@/features/clinicOnboarding/existingStaff'
import { approveClinicOnboarding, rejectClinicOnboarding } from '@/features/clinicOnboarding/decideApplication'
import { isValidEmail, normalizeEmail } from '@/auth/utilities/emailNormalization'
import {
  correctClinicOnboarding,
  McpOnboardingError,
  readClinicOnboarding,
  stageClinicOnboarding,
} from '@/features/clinicOnboarding/stagedApplication'

const clinicOnboardingGrants = {
  read: {
    tools: ['readClinicOnboarding', 'findEligibleClinicOnboardingStaff'],
    label: { en: 'Read applications', de: 'Vorgänge lesen' },
    description: 'View intake and status. Find eligible existing staff accounts.',
  },
  create: {
    tools: ['stageClinicOnboarding'],
    label: { en: 'Stage an application', de: 'Vorgang anlegen' },
    description: 'Stage an unpublished profile with a website, main specialty and first staff member.',
  },
  correct: {
    tools: ['correctClinicOnboarding'],
    label: { en: 'Correct an open application', de: 'Offenen Vorgang korrigieren' },
    description: 'Update intake details or the staff selection before a decision.',
  },
  decide: {
    tools: ['approveClinicOnboarding', 'rejectClinicOnboarding'],
    label: { en: 'Decide applications', de: 'Entscheiden' },
    description: 'Approve or reject Dashboard access. Approval starts account setup or links existing staff.',
  },
} as const

type ClinicOnboardingGrant = keyof typeof clinicOnboardingGrants
const onboardingGrantEntries = Object.entries(clinicOnboardingGrants) as [
  ClinicOnboardingGrant,
  (typeof clinicOnboardingGrants)[ClinicOnboardingGrant],
][]
const permissions = new WeakMap<PayloadRequest, Set<ClinicOnboardingGrant>>()

export const clinicOnboardingToolNames = onboardingGrantEntries.flatMap(([, { tools }]) => tools)

export const clinicOnboardingGrantField: GroupField = {
  type: 'group',
  name: 'clinicOnboarding',
  label: false,
  fields: onboardingGrantEntries.map(([name, { label, description }]) => ({
    name,
    label,
    type: 'checkbox',
    defaultValue: false,
    admin: { description },
  })),
}

export function mapClinicOnboardingGrants(req: PayloadRequest, settings: MCPAccessSettings): MCPAccessSettings {
  const values = settings.clinicOnboarding as Record<string, unknown> | undefined
  const active = new Set(onboardingGrantEntries.filter(([grant]) => values?.[grant] === true).map(([grant]) => grant))
  permissions.set(req, active)
  return {
    ...settings,
    'payload-mcp-tool': {
      ...settings['payload-mcp-tool'],
      ...Object.fromEntries(
        onboardingGrantEntries.flatMap(([grant, { tools }]) => tools.map((tool) => [tool, active.has(grant)])),
      ),
    },
  }
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
const correctionInput = intake.partial().merge(applicationIdInput).extend({ clinicStaffId: id.optional() })
const stageInput = intake.partial({ contactFirstName: true, contactLastName: true, contactEmail: true }).extend({
  requestKey: z.string().trim().min(1).max(200),
  staffMode: z.enum(['new_account', 'existing_account']),
  clinicStaffId: id.optional(),
})

function defineOnboardingTool<Grant extends ClinicOnboardingGrant, Shape extends z.ZodRawShape>(
  grant: Grant,
  name: (typeof clinicOnboardingGrants)[Grant]['tools'][number],
  description: string,
  input: z.ZodObject<Shape>,
  run: (req: PayloadRequest, args: z.infer<z.ZodObject<Shape>>) => Promise<unknown>,
) {
  return {
    name,
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
    'readClinicOnboarding',
    'Read a staged clinic onboarding application and its current statuses.',
    applicationIdInput,
    readClinicOnboarding,
  ),
  defineOnboardingTool(
    'read',
    'findEligibleClinicOnboardingStaff',
    'Look up an activated, unassigned staff account by exact email and return its ID for explicit selection.',
    z.object({ email: contactEmail }),
    findEligibleClinicOnboardingStaff,
  ),
  defineOnboardingTool(
    'create',
    'stageClinicOnboarding',
    'Stage a pending clinic application and unpublished clinic. Select a new first staff account or an existing account by ID. Reuse the request key when retrying.',
    stageInput,
    (req, { staffMode, clinicStaffId, contactEmail, contactFirstName, contactLastName, ...details }) => {
      if (staffMode === 'existing_account') {
        if (!clinicStaffId || contactEmail !== undefined) {
          throw new McpOnboardingError('Select an existing staff account by ID.', 400)
        }
        return stageClinicOnboarding(req, { ...details, staffMode, clinicStaffId, contactFirstName, contactLastName })
      }
      if (clinicStaffId !== undefined || !contactEmail || !contactFirstName || !contactLastName) {
        throw new McpOnboardingError('Provide the new staff member’s first name, last name and email.', 400)
      }
      return stageClinicOnboarding(req, { ...details, staffMode, contactEmail, contactFirstName, contactLastName })
    },
  ),
  defineOnboardingTool(
    'correct',
    'correctClinicOnboarding',
    'Correct an open clinic onboarding application. Use clinicStaffId to change an existing-account selection.',
    correctionInput,
    (req, { applicationId, ...details }) => {
      if (!Object.values(details).some((value) => value !== undefined)) {
        throw new McpOnboardingError('Provide at least one detail to correct.', 400)
      }
      return correctClinicOnboarding(req, { applicationId, ...details })
    },
  ),
  defineOnboardingTool(
    'decide',
    'approveClinicOnboarding',
    'Approve Dashboard participation and prepare or assign the selected first staff account. Replay approval to resume new account setup.',
    applicationIdInput,
    approveClinicOnboarding,
  ),
  defineOnboardingTool(
    'decide',
    'rejectClinicOnboarding',
    'Reject an open onboarding application and record the reason.',
    applicationIdInput.extend({ reason: z.string().trim().min(1).max(2_000) }),
    rejectClinicOnboarding,
  ),
]
