import type { LegacyInquiryStatus } from '@/features/inquiryCommunication/contracts'

export const DEFAULT_INQUIRY_RETENTION_POLICY = {
  communicationReviewMonths: 12,
  key: 'inquiry-communication',
  moderationReviewMonths: 24,
  version: '2026-08-24',
} as const

const addUtcMonths = (value: string, months: number): string => {
  const source = new Date(value)
  if (Number.isNaN(source.getTime()) || !Number.isInteger(months) || months < 1) {
    throw new Error('A valid retention basis and positive whole-month period are required.')
  }

  const targetYear = source.getUTCFullYear() + Math.floor((source.getUTCMonth() + months) / 12)
  const targetMonth = (source.getUTCMonth() + months) % 12
  const lastTargetDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
  const target = new Date(source)
  target.setUTCFullYear(targetYear, targetMonth, Math.min(source.getUTCDate(), lastTargetDay))
  return target.toISOString()
}

export const communicationReviewDueAt = (basisAt: string, reviewMonths: number): string =>
  addUtcMonths(basisAt, reviewMonths)

export const moderationReviewDueAt = (input: {
  finalOutcomeAt: string | null
  measureEndedAt: string | null
  reviewMonths: number
}): string | null => {
  if (!input.finalOutcomeAt || !input.measureEndedAt) return null
  const basisAt =
    Date.parse(input.finalOutcomeAt) >= Date.parse(input.measureEndedAt) ? input.finalOutcomeAt : input.measureEndedAt
  return addUtcMonths(basisAt, input.reviewMonths)
}

export const isRetentionReviewDue = (input: {
  activeLegalHold: boolean
  now: string
  reviewDueAt: string | null
}): boolean =>
  Boolean(input.reviewDueAt && !input.activeLegalHold && Date.parse(input.reviewDueAt) <= Date.parse(input.now))

export const mapLegacyInquiryState = (
  status: LegacyInquiryStatus,
): { handlingStatus: 'contacted' | 'in_review' | 'spam' | 'submitted'; lifecycle: 'closed' | 'open' } => {
  switch (status) {
    case 'in_review':
      return { handlingStatus: 'in_review', lifecycle: 'open' }
    case 'contacted':
      return { handlingStatus: 'contacted', lifecycle: 'open' }
    case 'spam':
      return { handlingStatus: 'spam', lifecycle: 'closed' }
    case 'closed':
      return { handlingStatus: 'submitted', lifecycle: 'closed' }
    case 'submitted':
      return { handlingStatus: 'submitted', lifecycle: 'open' }
  }
}
