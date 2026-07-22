import { expect, type Locator, type Page } from '@playwright/test'

import { ensureRelationshipEligibilityFixtures } from '../../adminFixtures'
import { getAdminDocumentDrawer, getAdminFieldRoot, openAdminCreatePage, openAdminDocumentPage } from '../../adminUI'
import { defineJourneySteps } from '../fragments'
import type { AdminJourneyDefinition, AdminJourneyStep } from '../types'

type RecordId = number | string

type RelationshipEligibilityJourneyState = {
  childName: string
  doctorAId?: RecordId
  foreignProfileLabel: string
  ownProfileLabel: string
  rootAId?: RecordId
  rootAName: string
  rootBName: string
}

const openPicker = async (page: Page, fieldPath: string, query: string): Promise<Locator> => {
  const field = getAdminFieldRoot(page, fieldPath)
  const combobox = field.getByRole('combobox').first()
  await expect(combobox).toBeVisible()
  await combobox.click()
  await combobox.fill(query)
  await page.waitForTimeout(350)
  await expect(field.locator('.rs__loading-indicator')).toBeHidden({ timeout: 10_000 })
  await expect(field.locator('.rs__option, .rs__menu-notice--no-options').first()).toBeVisible({ timeout: 10_000 })
  return combobox
}

const closePicker = async (page: Page, fieldPath: string) => {
  await page.keyboard.press('Escape')
  await page.waitForTimeout(350)
  await expect(getAdminFieldRoot(page, fieldPath).locator('.rs__loading-indicator')).toBeHidden({ timeout: 10_000 })
}

const openUploadPicker = async (page: Page, fieldPath: string) => {
  const field = getAdminFieldRoot(page, fieldPath)
  await field.getByRole('button', { name: 'Choose from existing' }).click()
  const drawer = getAdminDocumentDrawer(page)
  await expect(drawer).toBeVisible()
  await expect(drawer.locator('.loading-overlay')).toBeHidden({ timeout: 10_000 })
  return drawer
}

const ensureFixturesStep: AdminJourneyStep<RelationshipEligibilityJourneyState> = {
  collections: ['doctors', 'doctorMedia', 'medical-specialties'],
  kind: 'api-fixture',
  label: 'Provision owned and foreign relationship fixtures',
  producesState: [
    'childName',
    'doctorAId',
    'foreignProfileLabel',
    'ownProfileLabel',
    'rootAId',
    'rootAName',
    'rootBName',
  ],
  run: async ({ request, state }) => {
    Object.assign(state, await ensureRelationshipEligibilityFixtures(request))
  },
  stepId: 'ensure-relationship-eligibility-fixtures',
}

const inspectDoctorProfilePickerStep: AdminJourneyStep<RelationshipEligibilityJourneyState> = {
  checkpoint: {
    label: 'Doctor profile media scoped to doctor and clinic',
    screenshotSlug: 'doctor-profile-image-eligibility',
  },
  collections: ['doctors', 'doctorMedia'],
  kind: 'assertion',
  label: 'Verify doctor profile image relationship options',
  requiresState: ['doctorAId'],
  run: async ({ page, state }) => {
    if (state.doctorAId === undefined) throw new Error('Relationship journey requires doctorAId.')
    await openAdminDocumentPage(page, 'doctors', state.doctorAId)
    await getAdminFieldRoot(page, 'profileImage').scrollIntoViewIfNeeded()
    await expect(
      page.getByText('Save the doctor first, then select an image owned by this doctor and clinic.'),
    ).toBeVisible()
    const existingDoctorDrawer = await openUploadPicker(page, 'profileImage')
    await expect(existingDoctorDrawer.getByText(state.ownProfileLabel, { exact: true })).toBeVisible()
    await expect(existingDoctorDrawer.getByText(state.foreignProfileLabel, { exact: true })).toHaveCount(0)
    await existingDoctorDrawer.getByRole('button', { name: 'Close' }).first().click()
    await expect(existingDoctorDrawer).toBeHidden()

    await openAdminCreatePage(page, 'doctors')
    await getAdminFieldRoot(page, 'profileImage').scrollIntoViewIfNeeded()
    await expect(
      page.getByText('Save the doctor first, then select an image owned by this doctor and clinic.'),
    ).toBeVisible()
    const newDoctorDrawer = await openUploadPicker(page, 'profileImage')
    await expect(newDoctorDrawer.getByText(state.ownProfileLabel, { exact: true })).toHaveCount(0)
    await newDoctorDrawer.getByRole('button', { name: 'Close' }).first().click()
    await expect(newDoctorDrawer).toBeHidden()
  },
  stepId: 'inspect-doctor-profile-picker',
}

const inspectSpecialtyParentPickerStep: AdminJourneyStep<RelationshipEligibilityJourneyState> = {
  checkpoint: {
    label: 'Medical specialty parent options limited to other top-level records',
    screenshotSlug: 'medical-specialty-parent-eligibility',
  },
  collections: ['medical-specialties'],
  kind: 'assertion',
  label: 'Verify medical specialty parent relationship options',
  requiresState: ['rootAId'],
  run: async ({ page, state }) => {
    if (state.rootAId === undefined) throw new Error('Relationship journey requires rootAId.')
    await openAdminDocumentPage(page, 'medical-specialties', state.rootAId)
    await getAdminFieldRoot(page, 'parentSpecialty').scrollIntoViewIfNeeded()
    await openPicker(page, 'parentSpecialty', state.rootBName)
    await expect(page.getByRole('option', { name: state.rootBName })).toBeVisible()
    await closePicker(page, 'parentSpecialty')

    await openPicker(page, 'parentSpecialty', state.rootAName)
    await expect(page.getByRole('option', { name: state.rootAName })).toHaveCount(0)
    await closePicker(page, 'parentSpecialty')

    await openPicker(page, 'parentSpecialty', state.childName)
    await expect(page.getByRole('option', { name: state.childName })).toHaveCount(0)
  },
  stepId: 'inspect-specialty-parent-picker',
}

export const relationshipEligibilityJourney: AdminJourneyDefinition<RelationshipEligibilityJourneyState> = {
  createState: () => ({
    childName: '',
    doctorAId: undefined,
    foreignProfileLabel: '',
    ownProfileLabel: '',
    rootAId: undefined,
    rootAName: '',
    rootBName: '',
  }),
  description: 'Inspect doctor and specialty relationship eligibility in the Admin UI.',
  journeyId: 'admin.relationships.validate-eligibility',
  metadata: {
    collections: ['doctors', 'doctorMedia', 'medical-specialties'],
    consumers: ['regression', 'capture'],
    entrypoints: ['collection-create', 'document-page'],
    riskTags: ['relationship-eligibility', 'ownership', 'hierarchy'],
  },
  persona: 'admin',
  steps: defineJourneySteps<RelationshipEligibilityJourneyState>([
    ensureFixturesStep,
    inspectDoctorProfilePickerStep,
    inspectSpecialtyParentPickerStep,
  ]),
}
