import { expect, type APIRequestContext } from '@playwright/test'
import { buildRichText } from '../../fixtures/richText'
import { getFirstCollectionDoc, getRecordId, type CollectionListResponse, type CreatedDocResponse } from './adminApi'

export { createSessionBoundRequestContext, getFirstCollectionDoc, getRecordId } from './adminApi'

type ClinicFixture = {
  clinicId: string | number
  clinicName: string
}

export const ensureCountryFixture = async (request: APIRequestContext) => {
  const existingCountry = await getFirstCollectionDoc(request, '/api/countries?depth=0&limit=1&sort=-createdAt')
  const existingCountryId = getRecordId(existingCountry?.id)
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
  const countryId = getRecordId(body.doc?.id)
  expect(countryId).toBeTruthy()

  return countryId as string | number
}

export const ensureCityFixture = async (request: APIRequestContext) => {
  const existingCity = await getFirstCollectionDoc(request, '/api/cities?depth=0&limit=1&sort=-createdAt')
  const existingCityId = getRecordId(existingCity?.id)
  if (existingCityId) {
    return existingCityId
  }

  const countryId = await ensureCountryFixture(request)

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
  const cityId = getRecordId(body.doc?.id)
  expect(cityId).toBeTruthy()

  return cityId as string | number
}

export const ensureClinicFixture = async (
  request: APIRequestContext,
  options: {
    clinicNamePrefix?: string
    reuseExisting?: boolean
  } = {},
) => {
  const { clinicNamePrefix = 'E2E Clinic', reuseExisting = true } = options

  if (reuseExisting) {
    const existingClinic = await getFirstCollectionDoc(
      request,
      '/api/clinics?depth=0&limit=1&sort=-createdAt&where[status][equals]=approved',
    )
    const existingClinicId = getRecordId(existingClinic?.id)
    const existingClinicName = typeof existingClinic?.name === 'string' ? existingClinic.name : undefined

    if (existingClinicId) {
      return {
        clinicId: existingClinicId,
        clinicName: existingClinicName ?? String(existingClinicId),
      }
    }
  }

  const cityId = await ensureCityFixture(request)
  const uniqueSuffix = Date.now()
  const clinicName = `${clinicNamePrefix} ${uniqueSuffix}`

  const response = await request.post('/api/clinics', {
    data: {
      name: clinicName,
      address: {
        street: 'Journey Street',
        houseNumber: '12A',
        zipCode: 34000,
        country: 'Turkey',
        city: cityId,
      },
      contact: {
        phoneNumber: '+90 555 0000000',
        email: `journey-clinic-${uniqueSuffix}@example.com`,
      },
      status: 'approved',
      supportedLanguages: ['english'],
    },
  })
  expect(response.ok()).toBeTruthy()

  const body = (await response.json()) as CreatedDocResponse
  const clinicId = getRecordId(body.doc?.id)
  expect(clinicId).toBeTruthy()

  return {
    clinicId: clinicId as string | number,
    clinicName,
  }
}

export const readAssignedClinicFixture = async (request: APIRequestContext): Promise<ClinicFixture> => {
  const clinicStaff = await getFirstCollectionDoc(request, '/api/clinicStaff?depth=1&limit=1&sort=-updatedAt')
  const clinicValue = clinicStaff?.clinic
  const clinicId = getRecordId(clinicValue)
  expect(clinicId).toBeTruthy()

  const populatedClinicName =
    clinicValue && typeof clinicValue === 'object' && typeof (clinicValue as { name?: unknown }).name === 'string'
      ? (clinicValue as { name: string }).name
      : undefined

  if (populatedClinicName) {
    return {
      clinicId: clinicId as string | number,
      clinicName: populatedClinicName,
    }
  }

  const clinicDoc = await getFirstCollectionDoc(
    request,
    `/api/clinics?depth=0&limit=1&where[id][equals]=${encodeURIComponent(String(clinicId))}`,
  )
  const clinicName = typeof clinicDoc?.name === 'string' ? clinicDoc.name : undefined

  return {
    clinicId: clinicId as string | number,
    clinicName: clinicName ?? String(clinicId),
  }
}

export const ensureMedicalSpecialtyFixture = async (
  request: APIRequestContext,
  options: {
    specialtyId?: string | number
    namePrefix?: string
    reuseExisting?: boolean
  } = {},
) => {
  const { specialtyId: requestedSpecialtyId, namePrefix = 'E2E Specialty', reuseExisting = true } = options

  if (requestedSpecialtyId !== undefined) {
    const specialtyDoc = await getFirstCollectionDoc(
      request,
      `/api/medical-specialties?depth=0&limit=1&where[id][equals]=${encodeURIComponent(String(requestedSpecialtyId))}`,
    )
    const specialtyId = getRecordId(specialtyDoc?.id)
    const specialtyName = typeof specialtyDoc?.name === 'string' ? specialtyDoc.name : undefined
    expect(specialtyId).toBeTruthy()
    expect(specialtyName).toBeTruthy()

    return {
      specialtyId: specialtyId as string | number,
      specialtyName: specialtyName as string,
    }
  }

  if (reuseExisting) {
    const existingSpecialty = await getFirstCollectionDoc(
      request,
      '/api/medical-specialties?depth=0&limit=1&sort=-createdAt',
    )
    const existingSpecialtyId = getRecordId(existingSpecialty?.id)
    const existingSpecialtyName = typeof existingSpecialty?.name === 'string' ? existingSpecialty.name : undefined

    if (existingSpecialtyId && existingSpecialtyName) {
      return {
        specialtyId: existingSpecialtyId,
        specialtyName: existingSpecialtyName,
      }
    }
  }

  const specialtyName = `${namePrefix} ${Date.now()}`
  const response = await request.post('/api/medical-specialties', {
    data: {
      name: specialtyName,
      description: 'Created during Playwright admin journey setup',
    },
  })
  expect(response.ok()).toBeTruthy()

  const body = (await response.json()) as CreatedDocResponse
  const specialtyId = getRecordId(body.doc?.id)
  expect(specialtyId).toBeTruthy()

  return {
    specialtyId: specialtyId as string | number,
    specialtyName,
  }
}

export const ensureTreatmentFixture = async (
  request: APIRequestContext,
  options: {
    medicalSpecialtyId?: string | number
    namePrefix?: string
    reuseExisting?: boolean
  } = {},
) => {
  const { medicalSpecialtyId, namePrefix = 'E2E Treatment', reuseExisting = true } = options

  if (reuseExisting) {
    const existingTreatment = await getFirstCollectionDoc(request, '/api/treatments?depth=0&limit=1&sort=-createdAt')
    const existingTreatmentId = getRecordId(existingTreatment?.id)
    const existingTreatmentName = typeof existingTreatment?.name === 'string' ? existingTreatment.name : undefined

    if (existingTreatmentId && existingTreatmentName) {
      return {
        medicalSpecialtyId:
          getRecordId(existingTreatment?.medicalSpecialty) ??
          medicalSpecialtyId ??
          (await ensureMedicalSpecialtyFixture(request)).specialtyId,
        treatmentId: existingTreatmentId,
        treatmentName: existingTreatmentName,
      }
    }
  }

  const specialtyFixture = await ensureMedicalSpecialtyFixture(request, {
    specialtyId: medicalSpecialtyId,
    reuseExisting: medicalSpecialtyId === undefined,
  })
  const treatmentName = `${namePrefix} ${Date.now()}`

  const response = await request.post('/api/treatments', {
    data: {
      description: buildRichText('Created during Playwright admin journey setup'),
      medicalSpecialty: specialtyFixture.specialtyId,
      name: treatmentName,
    },
  })
  expect(response.ok()).toBeTruthy()

  const body = (await response.json()) as CreatedDocResponse
  const treatmentId = getRecordId(body.doc?.id)
  expect(treatmentId).toBeTruthy()

  return {
    medicalSpecialtyId: specialtyFixture.specialtyId,
    treatmentId: treatmentId as string | number,
    treatmentName,
  }
}

export const ensureDoctorFixture = async (
  request: APIRequestContext,
  options: {
    clinicId?: string | number
  } = {},
) => {
  const clinicId = options.clinicId ?? (await ensureClinicFixture(request)).clinicId
  const uniqueSuffix = Date.now()
  const firstName = `E2E-Doctor-${uniqueSuffix}`
  const lastName = 'Journey'

  const response = await request.post('/api/doctors', {
    data: {
      firstName,
      lastName,
      gender: 'male',
      clinic: clinicId,
      qualifications: ['E2E Qualification'],
      languages: ['english'],
    },
  })
  expect(response.ok()).toBeTruthy()

  const body = (await response.json()) as CreatedDocResponse
  const doctorId = getRecordId(body.doc?.id)
  expect(doctorId).toBeTruthy()

  return {
    doctorId: doctorId as string | number,
    doctorFullName: `${firstName} ${lastName}`,
  }
}

export const ensureApprovedClinicStaffAccess = async (
  request: APIRequestContext,
  options: {
    clinicId?: string | number
    email: string
  },
) => {
  const clinic = options.clinicId
    ? { clinicId: options.clinicId }
    : await ensureClinicFixture(request, { reuseExisting: true })
  const basicUserResponse = await request.get(
    `/api/basicUsers?depth=0&limit=1&where[email][equals]=${encodeURIComponent(options.email)}`,
  )
  expect(basicUserResponse.ok()).toBeTruthy()

  const basicUserBody = (await basicUserResponse.json()) as CollectionListResponse
  const basicUser = basicUserBody.docs?.[0]
  const basicUserId = getRecordId(basicUser?.id)
  expect(basicUserId).toBeTruthy()

  const clinicStaffResponse = await request.get(
    `/api/clinicStaff?depth=0&limit=1&where[user][equals]=${encodeURIComponent(String(basicUserId))}`,
  )
  expect(clinicStaffResponse.ok()).toBeTruthy()

  const clinicStaffBody = (await clinicStaffResponse.json()) as CollectionListResponse
  const clinicStaff = clinicStaffBody.docs?.[0]
  const clinicStaffId = getRecordId(clinicStaff?.id)
  expect(clinicStaffId).toBeTruthy()

  const currentClinicId = getRecordId(clinicStaff?.clinic)
  const currentStatus = typeof clinicStaff?.status === 'string' ? clinicStaff.status : undefined

  if (currentClinicId !== clinic.clinicId || currentStatus !== 'approved') {
    const patchResponse = await request.patch(`/api/clinicStaff/${clinicStaffId}`, {
      data: {
        clinic: clinic.clinicId,
        status: 'approved',
      },
    })
    expect(patchResponse.ok()).toBeTruthy()
  }

  return {
    basicUserId: basicUserId as string | number,
    clinicId: clinic.clinicId,
    clinicStaffId: clinicStaffId as string | number,
  }
}
