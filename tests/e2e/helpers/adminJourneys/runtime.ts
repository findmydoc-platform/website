import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import type {
  AdminJourneyCaptureArtifact,
  AdminJourneyCaptureHandler,
  AdminJourneyDefinition,
  AdminJourneyExecutionResult,
  AdminJourneyMode,
  AdminJourneyPersona,
} from './types'

const sanitizeOutputSegment = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export const getAdminJourneyOutputSlug = (journeyId: string) => sanitizeOutputSegment(journeyId)

export async function executeAdminJourney<TState extends Record<string, unknown>>(
  journey: AdminJourneyDefinition<TState>,
  options: {
    captureHandler?: AdminJourneyCaptureHandler<TState>
    initialState?: Partial<TState>
    mode: AdminJourneyMode
    page: Parameters<AdminJourneyDefinition<TState>['steps'][number]['run']>[0]['page']
    persona: AdminJourneyPersona
    request: Parameters<AdminJourneyDefinition<TState>['steps'][number]['run']>[0]['request']
  },
): Promise<AdminJourneyExecutionResult<TState>> {
  if (journey.persona !== options.persona) {
    throw new Error(
      `Journey ${journey.journeyId} only supports persona ${journey.persona}. Received ${options.persona}.`,
    )
  }

  const state = {
    ...journey.createState(),
    ...options.initialState,
  } as TState
  const checkpoints: AdminJourneyCaptureArtifact[] = []

  for (const [stepIndex, step] of journey.steps.entries()) {
    await step.run({
      mode: options.mode,
      page: options.page,
      persona: options.persona,
      request: options.request,
      state,
    })

    if (options.captureHandler && step.checkpoint) {
      const checkpoint = await options.captureHandler({
        journey,
        page: options.page,
        state,
        step,
        stepIndex,
      })

      if (checkpoint) {
        checkpoints.push(checkpoint)
      }
    }
  }

  return {
    checkpoints,
    journeyId: journey.journeyId,
    persona: options.persona,
    state,
  }
}

export const createJourneyCaptureHandler = async <TState extends Record<string, unknown>>(options: {
  outputDir: string
}) => {
  await mkdir(options.outputDir, { recursive: true })

  return async ({
    page,
    step,
    stepIndex,
  }: Parameters<AdminJourneyCaptureHandler<TState>>[0]): Promise<AdminJourneyCaptureArtifact | undefined> => {
    if (!step.checkpoint) {
      return undefined
    }

    const screenshotFileName = `${String(stepIndex + 1).padStart(2, '0')}-${step.checkpoint.screenshotSlug}.png`
    const screenshotPath = path.join(options.outputDir, screenshotFileName)

    await page.screenshot({
      path: screenshotPath,
    })

    return {
      label: step.checkpoint.label ?? step.label,
      screenshotPath,
      screenshotSlug: step.checkpoint.screenshotSlug,
      stepId: step.stepId,
    }
  }
}
