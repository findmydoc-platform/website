import { describe, expect, it, vi } from 'vitest'
import {
  getAdminJourneyDefinition,
  listAdminJourneys,
  executeAdminJourney,
  createCollectionCreateFragment,
  createJoinDrawerRelationFragment,
  defineJourneySteps,
  getAdminJourneyOutputSlug,
} from '../../e2e/helpers/adminJourneys'
import type { APIRequestContext, Page } from '@playwright/test'
import type { AdminJourneyDefinition, AdminJourneyStep } from '../../e2e/helpers/adminJourneys'

const hasUsableStateValue = (value: unknown) => value !== undefined && value !== null && value !== ''

const getAvailableStateKeys = (journey: AdminJourneyDefinition<Record<string, unknown>>) => {
  return new Set(
    Object.entries(journey.createState())
      .filter(([, value]) => hasUsableStateValue(value))
      .map(([key]) => key),
  )
}

describe('admin journey fragments', () => {
  type FragmentTestState = {
    parentId?: string
    recordId?: string
    recordName: string
    relationId?: string
  }

  const fillRecordStep = {
    label: 'Fill record',
    run: async () => undefined,
    stepId: 'fill-record',
  } satisfies AdminJourneyStep<FragmentTestState>

  const captureRelationStep = {
    label: 'Capture relation id',
    producesState: ['relationId'],
    run: async () => undefined,
    stepId: 'capture-relation-id',
  } satisfies AdminJourneyStep<FragmentTestState>

  it('composes a collection create fragment with save output and after-save checks', () => {
    const steps = createCollectionCreateFragment<FragmentTestState, 'recordId'>({
      afterSave: [
        {
          label: 'Assert record',
          run: async () => undefined,
          stepId: 'assert-record',
        },
      ],
      collectionSlug: 'records',
      fill: fillRecordStep,
      open: {
        label: 'Open record create page',
        stepId: 'open-record-create-page',
      },
      recordIdField: 'recordId',
      save: {
        label: 'Save record',
        stepId: 'save-record',
      },
    })

    expect(steps.map((step) => step.stepId)).toEqual([
      'open-record-create-page',
      'fill-record',
      'save-record',
      'assert-record',
    ])
    expect(steps[0]?.collections).toEqual(['records'])
    expect(steps[2]?.producesState).toEqual(['recordId'])
  })

  it('composes a join-drawer relation fragment with optional document opening', () => {
    const steps = createJoinDrawerRelationFragment<FragmentTestState, 'parentId'>({
      capture: captureRelationStep,
      drawer: {
        fieldPath: 'relations',
        label: 'Open relation drawer',
        stepId: 'open-relation-drawer',
      },
      fill: fillRecordStep,
      openDocument: {
        collectionSlug: 'parents',
        label: 'Open parent document',
        recordIdField: 'parentId',
        stepId: 'open-parent-document',
      },
      save: {
        label: 'Save relation drawer',
        stepId: 'save-relation-drawer',
      },
      tab: {
        label: 'Open relations tab',
        stepId: 'open-relations-tab',
        tabLabel: 'Relations',
      },
    })

    expect(steps.map((step) => step.stepId)).toEqual([
      'open-parent-document',
      'open-relations-tab',
      'open-relation-drawer',
      'fill-record',
      'save-relation-drawer',
      'capture-relation-id',
    ])
    expect(steps[0]?.requiresState).toEqual(['parentId'])
  })

  it('allows composing fragments for already-open document flows', () => {
    const steps = defineJourneySteps<FragmentTestState>(
      createCollectionCreateFragment<FragmentTestState, 'recordId'>({
        collectionSlug: 'records',
        fill: fillRecordStep,
        open: {
          label: 'Open record create page',
          stepId: 'open-record-create-page',
        },
        recordIdField: 'recordId',
        save: {
          label: 'Save record',
          stepId: 'save-record',
        },
      }),
      createJoinDrawerRelationFragment<FragmentTestState, 'recordId'>({
        capture: captureRelationStep,
        drawer: {
          fieldPath: 'relations',
          label: 'Open relation drawer',
          stepId: 'open-relation-drawer',
        },
        fill: fillRecordStep,
        save: {
          label: 'Save relation drawer',
          stepId: 'save-relation-drawer',
        },
        tab: {
          label: 'Open relations tab',
          stepId: 'open-relations-tab',
          tabLabel: 'Relations',
        },
      }),
    )

    expect(steps.map((step) => step.stepId)).toEqual([
      'open-record-create-page',
      'fill-record',
      'save-record',
      'open-relations-tab',
      'open-relation-drawer',
      'fill-record',
      'save-relation-drawer',
      'capture-relation-id',
    ])
  })
})

describe('admin journey registry', () => {
  it('exposes the expected shared journey ids', () => {
    expect(listAdminJourneys().map((journey) => journey.journeyId)).toEqual(
      expect.arrayContaining([
        'admin.clinics.create-draft',
        'admin.clinictreatments.create-link',
        'admin.medical-specialties.create',
        'admin.treatments.create',
        'admin.treatments.add-clinictreatment-from-join',
        'admin.treatments.add-doctortreatment-from-join',
        'admin.doctorspecialties.create-link',
        'admin.doctortreatments.create-link',
        'admin.medical-network.create-specialty-and-link-doctor',
        'admin.medical-network.create-treatment-and-link-clinic-and-doctor',
        'admin.tags.create',
        'clinic.clinics.add-treatment-from-join',
        'clinic.doctors.create-and-link-specialty',
        'clinic.doctors.create-and-link-treatment',
      ]),
    )
  })

  it('rejects persona mismatches when executing a journey', async () => {
    const journey = {
      createState: () => ({ value: 'ok' }),
      description: 'test journey',
      journeyId: 'admin.test',
      metadata: {
        collections: ['clinics'],
        consumers: ['smoke'],
        entrypoints: ['collection-create'],
        riskTags: ['test'],
      },
      persona: 'admin' as const,
      steps: [],
    } satisfies AdminJourneyDefinition<{ value: string }>

    await expect(
      executeAdminJourney(journey, {
        mode: 'smoke',
        page: {} as Page,
        persona: 'clinic',
        request: {} as APIRequestContext,
      }),
    ).rejects.toThrow('Journey admin.test only supports persona admin. Received clinic.')
  })

  it('requires coverage metadata for every registered journey', () => {
    for (const journey of listAdminJourneys()) {
      expect(journey.metadata.collections.length, journey.journeyId).toBeGreaterThan(0)
      expect(journey.metadata.consumers.length, journey.journeyId).toBeGreaterThan(0)
      expect(journey.metadata.entrypoints.length, journey.journeyId).toBeGreaterThan(0)
      expect(journey.metadata.riskTags.length, journey.journeyId).toBeGreaterThan(0)
    }
  })

  it('keeps step collection metadata inside journey collection metadata', () => {
    for (const journey of listAdminJourneys()) {
      const journeyCollections = new Set(journey.metadata.collections)
      const stepCollections = journey.steps.flatMap((step) => step.collections ?? [])

      for (const collection of stepCollections) {
        expect(journeyCollections.has(collection), `${journey.journeyId} step collection ${collection}`).toBe(true)
      }
    }
  })

  it('marks capture consumers with at least one checkpoint', () => {
    for (const journey of listAdminJourneys()) {
      if (!journey.metadata.consumers.includes('capture')) {
        continue
      }

      expect(
        journey.steps.some((step) => step.checkpoint),
        `${journey.journeyId} is capture-ready but has no checkpoints`,
      ).toBe(true)
    }
  })

  it('satisfies declared step state requirements before each step runs', () => {
    for (const journey of listAdminJourneys()) {
      const availableStateKeys = getAvailableStateKeys(
        journey as unknown as AdminJourneyDefinition<Record<string, unknown>>,
      )

      for (const step of journey.steps) {
        for (const requiredKey of step.requiresState ?? []) {
          expect(
            availableStateKeys.has(requiredKey),
            `${journey.journeyId}:${step.stepId} requires ${requiredKey} before a prior step provides it`,
          ).toBe(true)
        }

        for (const producedKey of step.producesState ?? []) {
          availableStateKeys.add(producedKey)
        }
      }
    }
  })
})

describe('admin journey runtime', () => {
  it('captures checkpoints in execution order', async () => {
    const journey = {
      createState: () => ({ values: [] as string[] }),
      description: 'capture test',
      journeyId: 'admin.capture',
      metadata: {
        collections: ['clinics'],
        consumers: ['capture'],
        entrypoints: ['collection-create'],
        riskTags: ['test'],
      },
      persona: 'admin' as const,
      steps: [
        {
          checkpoint: {
            label: 'First step',
            screenshotSlug: 'first',
          },
          label: 'Run first step',
          run: async ({ state }: { state: { values: string[] } }) => {
            state.values.push('first')
          },
          stepId: 'first-step',
        },
        {
          label: 'Run second step',
          run: async ({ state }: { state: { values: string[] } }) => {
            state.values.push('second')
          },
          stepId: 'second-step',
        },
      ],
    } satisfies AdminJourneyDefinition<{ values: string[] }>
    const captureHandler = vi.fn(async () => ({
      label: 'First step',
      screenshotPath: '/tmp/01-first.png',
      screenshotSlug: 'first',
      stepId: 'first-step',
    }))

    const result = await executeAdminJourney(journey, {
      captureHandler,
      initialState: {
        values: [],
      },
      mode: 'capture',
      page: {} as Page,
      persona: 'admin',
      request: {} as APIRequestContext,
    })

    expect(result.state.values).toEqual(['first', 'second'])
    expect(result.checkpoints).toEqual([
      {
        label: 'First step',
        screenshotPath: '/tmp/01-first.png',
        screenshotSlug: 'first',
        stepId: 'first-step',
      },
    ])
    expect(captureHandler).toHaveBeenCalledTimes(1)
  })

  it('normalizes journey ids into filesystem-safe output slugs', () => {
    expect(getAdminJourneyOutputSlug('clinic.doctors.create-and-link-specialty')).toBe(
      'clinic-doctors-create-and-link-specialty',
    )
  })

  it('keeps clinic journeys scoped to the clinic persona in the registry', () => {
    const journey = getAdminJourneyDefinition('clinic.doctors.create-and-link-specialty')
    expect(journey.persona).toBe('clinic')
  })

  it('keeps clinic treatment journeys scoped to the clinic persona in the registry', () => {
    const journey = getAdminJourneyDefinition('clinic.clinics.add-treatment-from-join')
    expect(journey.persona).toBe('clinic')
  })

  it('registers join-based treatment journeys with ordered reusable steps', () => {
    const journey = getAdminJourneyDefinition('admin.treatments.add-clinictreatment-from-join')

    expect(journey.steps.map((step) => step.stepId)).toEqual([
      'ensure-clinic-fixture',
      'ensure-treatment-specialty-fixture',
      'ensure-treatment-fixture',
      'open-treatment-document',
      'open-associated-clinics-tab',
      'open-clinic-treatment-join-drawer',
      'fill-clinic-treatment-form',
      'save-clinic-treatment-drawer',
      'capture-clinic-treatment-id',
    ])

    expect(journey.steps.filter((step) => step.checkpoint).map((step) => step.stepId)).toEqual([
      'open-treatment-document',
      'open-clinic-treatment-join-drawer',
      'fill-clinic-treatment-form',
      'save-clinic-treatment-drawer',
    ])
  })

  it('provisions the assigned clinic before opening clinic join journeys', () => {
    const journey = getAdminJourneyDefinition('clinic.clinics.add-treatment-from-join')

    expect(journey.steps.map((step) => step.stepId)).toEqual([
      'ensure-assigned-clinic-fixture',
      'open-assigned-clinic-document',
      'open-clinic-general-tab',
      'open-clinic-treatment-join-drawer',
      'fill-clinic-treatment-form',
      'save-clinic-treatment-drawer',
      'capture-clinic-treatment-id',
    ])
  })
})
