import {
  createOpenCreatePageStep,
  createOpenDocumentPageStep,
  createOpenJoinCreateDrawerStep,
  createOpenTabStep,
  createSaveDocumentStep,
  createSaveDrawerDocumentStep,
} from './steps'
import type { AdminJourneyStep } from './types'

type StepDescriptor<TState extends Record<string, unknown>> = {
  checkpoint?: AdminJourneyStep<TState>['checkpoint']
  label: string
  stepId: string
}

type OpenDocumentDescriptor<
  TState extends Record<string, unknown>,
  TKey extends keyof TState & string,
> = StepDescriptor<TState> & {
  collectionSlug: string
  recordIdField: TKey
}

type OpenTabDescriptor<TState extends Record<string, unknown>> = StepDescriptor<TState> & {
  tabLabel: string
}

type OpenJoinDrawerDescriptor<TState extends Record<string, unknown>> = StepDescriptor<TState> & {
  fieldPath: string
}

export const defineJourneySteps = <TState extends Record<string, unknown>>(
  ...fragments: ReadonlyArray<readonly AdminJourneyStep<TState>[]>
): AdminJourneyStep<TState>[] => fragments.flat()

export const createCollectionCreateFragment = <
  TState extends Record<string, unknown>,
  TKey extends keyof TState & string,
>(options: {
  afterSave?: readonly AdminJourneyStep<TState>[]
  collectionSlug: string
  fill: AdminJourneyStep<TState>
  open: StepDescriptor<TState>
  recordIdField: TKey
  save: StepDescriptor<TState>
}): AdminJourneyStep<TState>[] =>
  [
    createOpenCreatePageStep<TState>({
      checkpoint: options.open.checkpoint,
      collectionSlug: options.collectionSlug,
      label: options.open.label,
      stepId: options.open.stepId,
    }),
    options.fill,
    createSaveDocumentStep<TState, TKey>({
      checkpoint: options.save.checkpoint,
      collectionSlug: options.collectionSlug,
      label: options.save.label,
      recordIdField: options.recordIdField,
      stepId: options.save.stepId,
    }),
    ...(options.afterSave ?? []),
  ] satisfies AdminJourneyStep<TState>[]

export const createOpenDocumentFragment = <TState extends Record<string, unknown>, TKey extends keyof TState & string>(
  options: OpenDocumentDescriptor<TState, TKey>,
): AdminJourneyStep<TState>[] =>
  [
    createOpenDocumentPageStep<TState, TKey>({
      checkpoint: options.checkpoint,
      collectionSlug: options.collectionSlug,
      label: options.label,
      recordIdField: options.recordIdField,
      stepId: options.stepId,
    }),
  ] satisfies AdminJourneyStep<TState>[]

export const createJoinDrawerRelationFragment = <
  TState extends Record<string, unknown>,
  TKey extends keyof TState & string,
>(options: {
  capture?: AdminJourneyStep<TState>
  drawer: OpenJoinDrawerDescriptor<TState>
  fill: AdminJourneyStep<TState>
  openDocument?: OpenDocumentDescriptor<TState, TKey>
  save: StepDescriptor<TState>
  tab: OpenTabDescriptor<TState>
}): AdminJourneyStep<TState>[] =>
  [
    ...(options.openDocument
      ? [
          createOpenDocumentPageStep<TState, TKey>({
            checkpoint: options.openDocument.checkpoint,
            collectionSlug: options.openDocument.collectionSlug,
            label: options.openDocument.label,
            recordIdField: options.openDocument.recordIdField,
            stepId: options.openDocument.stepId,
          }),
        ]
      : []),
    createOpenTabStep<TState>({
      checkpoint: options.tab.checkpoint,
      label: options.tab.label,
      stepId: options.tab.stepId,
      tabLabel: options.tab.tabLabel,
    }),
    createOpenJoinCreateDrawerStep<TState>({
      checkpoint: options.drawer.checkpoint,
      fieldPath: options.drawer.fieldPath,
      label: options.drawer.label,
      stepId: options.drawer.stepId,
    }),
    options.fill,
    createSaveDrawerDocumentStep<TState>({
      checkpoint: options.save.checkpoint,
      label: options.save.label,
      stepId: options.save.stepId,
    }),
    ...(options.capture ? [options.capture] : []),
  ] satisfies AdminJourneyStep<TState>[]
