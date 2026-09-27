import type { EmailEnvironment } from './environment'

// The store integration owns this decision. Missing or unavailable evidence never grants clearance.
export type SuppressionLookup = (
  recipient: Readonly<{ address: string; environment: EmailEnvironment }>,
  signal: AbortSignal,
) => Promise<'cleared' | 'suppressed' | 'unavailable'>
