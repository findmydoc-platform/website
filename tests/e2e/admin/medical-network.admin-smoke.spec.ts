import { expect, test, type APIRequestContext } from '@playwright/test'
import {
  createBrowserIssueCollector,
  expectNoBrowserIssues,
  saveAdminDocumentForCollection,
  selectComboboxOption,
} from '../helpers/adminUI'

test.describe.configure({ mode: 'serial' })

type CollectionListResponse = {
  docs?: Array<{ id?: string | number }>
}

type CreatedDocResponse = {
  doc?: { id?: string | number }
}

const getFirstCollectionDocId = async (request: APIRequestContext, path: string) => {
  const response = await request.get(path)
  expect(response.ok()).toBeTruthy()

  const body = (await response.json()) as CollectionListResponse
  return body.docs?.[0]?.id
}

const ensureCountryId = async (request: APIRequestContext) => {
  const existingCountryId = await getFirstCollectionDocId(request, '/api/countries?depth=0&limit=1&sort=-createdAt')
  if (existingCountryId) {
    return existingCountryId
  }

  const response = await request.post('/api/countries', {
    data: {
      name: 'Turkey',
      isoCode: 'TR',
      language: 'turkish',
      currency: 'TRY',
    },
  })
  expect(response.ok()).toBeTruthy()

  const body = (await response.json()) as CreatedDocResponse
  expect(body.doc?.id).toBeTruthy()

  return body.doc?.id
}

const ensureCityId = async (request: APIRequestContext) => {
  const existingCityId = await getFirstCollectionDocId(request, '/api/cities?depth=0&limit=1&sort=-createdAt')
  if (existingCityId) {
    return existingCityId
  }

  const countryId = await ensureCountryId(request)
  expect(countryId).toBeTruthy()

  const response = await request.post('/api/cities', {
    data: {
      name: 'Istanbul',
      airportcode: 'IST',
      coordinates: [41.0082, 28.9784],
      country: countryId,
    },
  })
  expect(response.ok()).toBeTruthy()

  const body = (await response.json()) as CreatedDocResponse
  expect(body.doc?.id).toBeTruthy()

  return body.doc?.id
}

const ensureClinicFixture = async (request: APIRequestContext) => {
  const existingClinicId = await getFirstCollectionDocId(request, '/api/clinics?depth=0&limit=1&sort=-createdAt')
  if (existingClinicId) {
    return existingClinicId
  }

  const cityId = await ensureCityId(request)
  expect(cityId).toBeTruthy()

  const uniqueSuffix = Date.now()
  const clinicName = `E2E Clinic ${uniqueSuffix}`
  const response = await request.post('/api/clinics', {
    data: {
      name: clinicName,
      address: {
        street: 'Test Street',
        houseNumber: '1',
        zipCode: 34000,
        country: 'Turkey',
        city: cityId,
      },
      contact: {
        phoneNumber: '+1000000000',
        email: `e2e-clinic-${uniqueSuffix}@example.com`,
      },
      status: 'approved',
      supportedLanguages: ['english'],
    },
  })
  expect(response.ok()).toBeTruthy()

  const body = (await response.json()) as CreatedDocResponse
  expect(body.doc?.id).toBeTruthy()

  return body.doc?.id
}

const createDoctorFixture = async (request: APIRequestContext) => {
  const clinicId = await ensureClinicFixture(request)
  expect(clinicId).toBeTruthy()

  const uniqueSuffix = Date.now()
  const firstName = `E2E-Doctor-${uniqueSuffix}`
  const lastName = 'Relation'

  const doctorResponse = await request.post('/api/doctors', {
    data: {
      firstName,
      lastName,
      gender: 'male',
      clinic: clinicId,
      qualifications: ['E2E Qualification'],
      languages: ['english'],
    },
  })
  expect(doctorResponse.ok()).toBeTruthy()

  return `${firstName} ${lastName}`
}

test('medical specialties collection screen is reachable for platform staff @smoke', async ({ page }) => {
  const issues = createBrowserIssueCollector(page)

  await page.goto('/admin/collections/medical-specialties', { waitUntil: 'domcontentloaded' })

  await expect(page).toHaveURL(/\/admin\/collections\/medical-specialties(?:\/)?$/)
  await expect(page.getByText('Medical Specialties', { exact: true }).first()).toBeVisible()
  await expectNoBrowserIssues(issues)
})

test('platform staff can create a medical specialty from the admin UI @smoke', async ({ page }) => {
  const issues = createBrowserIssueCollector(page)
  const specialtyName = `E2E Specialty ${Date.now()}`

  await page.goto('/admin/collections/medical-specialties/create', { waitUntil: 'domcontentloaded' })

  await expect(page.getByText('Use this collection for specialty taxonomy only.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'See seeding documentation' })).toBeVisible()

  await page.getByLabel('Name').fill(specialtyName)
  await page.getByLabel('Description').fill('Created during Playwright admin smoke flow')

  await saveAdminDocumentForCollection(page, 'medical-specialties')

  await expect(page.getByLabel('Name')).toHaveValue(specialtyName)
  await expectNoBrowserIssues(issues)
})

test('platform staff can create a doctor specialty relation from the admin UI @smoke', async ({ page }) => {
  // This save path can emit a transient server-action fetch error even when the relation is created successfully.
  const issues = createBrowserIssueCollector(page, {
    ignoredConsoleErrors: [/TypeError: Failed to fetch/, /TypeError: network error/],
  })
  const specialtyName = `E2E Relation Specialty ${Date.now()}`
  const doctorFullName = await createDoctorFixture(page.request)

  await page.goto('/admin/collections/medical-specialties/create', { waitUntil: 'domcontentloaded' })
  await page.getByLabel('Name').fill(specialtyName)
  await saveAdminDocumentForCollection(page, 'medical-specialties')

  await page.goto('/admin/collections/doctorspecialties/create', { waitUntil: 'domcontentloaded' })

  await selectComboboxOption(page, 'Doctor', doctorFullName)
  await selectComboboxOption(page, 'Medical Specialty', specialtyName)
  await selectComboboxOption(page, 'Specialization Level', 'Specialist')

  await saveAdminDocumentForCollection(page, 'doctorspecialties')

  await expect(page).toHaveURL(/\/admin\/collections\/doctorspecialties\/[^/]+$/)
  await expectNoBrowserIssues(issues)
})

test('platform staff can create a tag from the admin UI @smoke', async ({ page }) => {
  const issues = createBrowserIssueCollector(page)
  const tagName = `e2e-tag-${Date.now()}`

  await page.goto('/admin/collections/tags/create', { waitUntil: 'domcontentloaded' })
  await page.getByLabel('Name').fill(tagName)

  await saveAdminDocumentForCollection(page, 'tags')

  await expect(page.getByLabel('Name')).toHaveValue(tagName)
  await expectNoBrowserIssues(issues)
})
