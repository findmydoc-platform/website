import { expect } from '@playwright/test'
import type { AdminJourneyDefinition } from '../types'
import { createOpenDocumentPageStep } from '../steps'

type GalleryJourneyState = { mediaId?: string | number }

export const clinicGalleryJourney: AdminJourneyDefinition<GalleryJourneyState> = {
  createState: () => ({ mediaId: undefined }),
  description: 'Add a clinic image to its profile gallery after resolving unsaved edits.',
  journeyId: 'admin.clinic-media.add-to-gallery',
  metadata: {
    collections: ['clinicMedia', 'clinics'],
    consumers: ['regression'],
    entrypoints: ['document-page'],
    riskTags: ['clinic-gallery', 'admin-crud'],
  },
  persona: 'admin',
  steps: [
    {
      kind: 'assertion',
      label: 'Verify the clinic image fixture',
      producesState: ['mediaId'],
      stepId: 'verify-clinic-image-fixture',
      run: async ({ state }) => {
        if (!state.mediaId) throw new Error('A clinic image fixture is required.')
      },
    },
    createOpenDocumentPageStep({
      collectionSlug: 'clinicMedia',
      label: 'Open the clinic image',
      recordIdField: 'mediaId',
      stepId: 'open-clinic-image',
    }),
    {
      kind: 'assertion',
      label: 'Require unsaved image edits to be resolved',
      stepId: 'check-unsaved-edits',
      run: async ({ page }) => {
        await page.getByLabel('Alt', { exact: true }).fill('Unsaved gallery text')
        await expect(page.getByText('Save or discard changes before adding this image.')).toBeVisible()
        await expect(page.getByRole('button', { name: 'Add to clinic gallery' })).toBeDisabled()
        await page.waitForLoadState('networkidle')
        await page.reload({ waitUntil: 'domcontentloaded' })
      },
    },
    {
      kind: 'save',
      label: 'Add the image to the clinic gallery',
      stepId: 'add-to-gallery',
      run: async ({ page }) => {
        await page.waitForLoadState('networkidle')
        await page.getByRole('button', { name: 'Add to clinic gallery' }).click()
        await expect(page.getByRole('status').filter({ hasText: 'Image added to the clinic gallery.' })).toBeVisible()
      },
    },
  ],
}
