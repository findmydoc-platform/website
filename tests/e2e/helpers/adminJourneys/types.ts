import type { APIRequestContext, Page } from '@playwright/test'

export const ADMIN_JOURNEY_PERSONAS = ['admin', 'clinic'] as const
export const ADMIN_JOURNEY_MODES = ['smoke', 'regression', 'capture'] as const

export type AdminJourneyPersona = (typeof ADMIN_JOURNEY_PERSONAS)[number]
export type AdminJourneyMode = (typeof ADMIN_JOURNEY_MODES)[number]
export type AdminJourneyConsumer = AdminJourneyMode
export type AdminJourneyEntryPoint =
  | 'collection-create'
  | 'collection-list'
  | 'dashboard'
  | 'document-page'
  | 'join-drawer'
export type AdminJourneyStepKind = 'api-fixture' | 'assertion' | 'capture' | 'form-fill' | 'navigation' | 'save'

export type AdminJourneyCheckpoint = {
  label?: string
  screenshotSlug: string
}

export type AdminJourneyStep<TState extends Record<string, unknown>> = {
  collections?: readonly string[]
  checkpoint?: AdminJourneyCheckpoint
  kind?: AdminJourneyStepKind
  label: string
  producesState?: ReadonlyArray<keyof TState & string>
  requiresState?: ReadonlyArray<keyof TState & string>
  run: (context: AdminJourneyStepContext<TState>) => Promise<void>
  stepId: string
}

export type AdminJourneyMetadata = {
  collections: readonly string[]
  consumers: readonly AdminJourneyConsumer[]
  entrypoints: readonly AdminJourneyEntryPoint[]
  riskTags: readonly string[]
}

export type AdminJourneyDefinition<TState extends Record<string, unknown>> = {
  createState: () => TState
  description: string
  journeyId: string
  metadata: AdminJourneyMetadata
  persona: AdminJourneyPersona
  steps: Array<AdminJourneyStep<TState>>
}

export type AdminJourneyStepContext<TState extends Record<string, unknown>> = {
  mode: AdminJourneyMode
  page: Page
  persona: AdminJourneyPersona
  request: APIRequestContext
  state: TState
}

export type AdminJourneyCaptureArtifact = {
  label: string
  screenshotPath: string
  screenshotSlug: string
  stepId: string
}

export type AdminJourneyExecutionResult<TState extends Record<string, unknown>> = {
  checkpoints: AdminJourneyCaptureArtifact[]
  journeyId: string
  persona: AdminJourneyPersona
  state: TState
}

export type AdminJourneyCaptureHandler<TState extends Record<string, unknown>> = (options: {
  journey: AdminJourneyDefinition<TState>
  page: Page
  state: TState
  step: AdminJourneyStep<TState>
  stepIndex: number
}) => Promise<AdminJourneyCaptureArtifact | undefined>
