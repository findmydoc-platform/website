import type { AdminJourneyDefinition } from '../types'
import { createCollectionCreateFragment } from '../fragments'
import { createAssertFieldValueStep, createFillTagStep } from '../steps'

type TagJourneyState = {
  tagId?: string
  tagName: string
}

export const tagCreateJourney: AdminJourneyDefinition<TagJourneyState> = {
  createState: () => ({
    tagId: undefined,
    tagName: `e2e-tag-${Date.now()}`,
  }),
  description: 'Create a tag from the admin UI.',
  journeyId: 'admin.tags.create',
  metadata: {
    collections: ['tags'],
    consumers: ['smoke', 'capture'],
    entrypoints: ['collection-create'],
    riskTags: ['content-taxonomy', 'admin-crud'],
  },
  persona: 'admin',
  steps: createCollectionCreateFragment<TagJourneyState, 'tagId'>({
    afterSave: [
      createAssertFieldValueStep({
        expectedValue: (state) => state.tagName,
        fieldLabel: 'Name',
        label: 'Verify the tag stays visible after save',
        stepId: 'assert-tag-name',
      }),
    ],
    collectionSlug: 'tags',
    fill: createFillTagStep({
      stepId: 'fill-tag-form',
      checkpoint: {
        label: 'Tag form filled',
        screenshotSlug: 'tag-form-filled',
      },
    }),
    open: {
      label: 'Open the tag create page',
      stepId: 'open-tag-create-page',
      checkpoint: {
        label: 'Tag create page',
        screenshotSlug: 'tag-create-page',
      },
    },
    recordIdField: 'tagId',
    save: {
      label: 'Save the tag',
      stepId: 'save-tag',
      checkpoint: {
        label: 'Tag saved',
        screenshotSlug: 'tag-saved',
      },
    },
  }),
}
