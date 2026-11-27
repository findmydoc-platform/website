import { APIError, type Endpoint } from 'payload'
import { z } from 'zod'
import { approveClinicOnboarding, rejectClinicOnboarding } from './decideApplication'
import { McpOnboardingError, requireClinicOnboardingOperator } from './stagedApplication'

export const applicationRevisionSchema = z
  .string()
  .regex(/^[a-f0-9]{64}$/u)
  .describe('Revision returned for the application under review.')
export const onboardingRejectionReasonSchema = z.string().trim().min(1).max(2_000)

const reviewRequest = z.discriminatedUnion('outcome', [
  z.object({ applicationRevision: applicationRevisionSchema, outcome: z.literal('approved') }),
  z.object({
    applicationRevision: applicationRevisionSchema,
    outcome: z.literal('rejected'),
    reason: onboardingRejectionReasonSchema,
  }),
])

export const clinicApplicationOnboardingDecisionEndpoint: Endpoint = {
  path: '/:id/onboarding-decision',
  method: 'post',
  handler: async (req) => {
    req.responseHeaders ??= new Headers()
    req.responseHeaders.set('Cache-Control', 'private, no-store')
    req.responseHeaders.append('Vary', 'Authorization, Cookie')

    await requireClinicOnboardingOperator(req)
    const applicationId = Number(req.routeParams?.id)
    const body = reviewRequest.safeParse(await req.json?.().catch(() => undefined))
    if (!Number.isSafeInteger(applicationId) || applicationId <= 0 || !body.success) {
      throw new APIError('Provide a valid application revision and review decision.', 400)
    }

    try {
      const input = { applicationId, applicationRevision: body.data.applicationRevision }
      const result =
        body.data.outcome === 'approved'
          ? await approveClinicOnboarding(req, input)
          : await rejectClinicOnboarding(req, { ...input, reason: body.data.reason })
      return Response.json(result, { headers: req.responseHeaders })
    } catch (error) {
      if (error instanceof McpOnboardingError || (error instanceof APIError && error.status === 403)) throw error
      throw new APIError(
        'The clinic onboarding decision could not be completed. Reload the application and try again.',
        409,
      )
    }
  },
}
