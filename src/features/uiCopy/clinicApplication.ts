import type messages from '@findmydoc-platform/ui-copy/en.json'

type ClinicApplicationMessageKey = keyof typeof messages.website.clinicApplication
type Translate = (key: ClinicApplicationMessageKey, values?: Record<string, number>) => string

export function buildClinicApplicationCopy(translate: Translate) {
  const statusLabels = {
    1: translate('started'),
    2: translate('halfway'),
    3: translate('almostDone'),
    4: translate('received'),
  }
  const total = Object.keys(statusLabels).length
  const stepLabels = {
    1: translate('step', { current: 1, total }),
    2: translate('step', { current: 2, total }),
    3: translate('step', { current: 3, total }),
    4: translate('step', { current: 4, total }),
  }
  const validation = {
    clinicName: { valueMissing: translate('nameRequired') },
    clinicWebsite: { valueMissing: translate('websiteRequired'), typeMismatch: translate('websiteInvalid') },
    contactEmail: { valueMissing: translate('emailRequired'), typeMismatch: translate('emailInvalid') },
    contactFirstName: { valueMissing: translate('firstNameRequired') },
    contactLastName: { valueMissing: translate('lastNameRequired') },
    contactRole: { valueMissing: translate('roleRequired') },
  }
  const fieldError = <Step extends number>(step: Step, fieldName: string, message: string) => ({
    step,
    fieldName,
    message,
  })
  return {
    title: translate('title'),
    description: translate('description'),
    unavailable: translate('unavailable'),
    statusLabels,
    stepLabels,
    continue: translate('continue'),
    back: translate('back'),
    pending: translate('pending'),
    pendingStatus: translate('pendingStatus'),
    submit: translate('submit'),
    details: {
      title: translate('detailsTitle'),
      description: translate('detailsDescription'),
      name: translate('clinicName'),
      namePlaceholder: translate('clinicNamePlaceholder'),
      website: translate('website'),
      notice: translate('locationNotice'),
    },
    specialties: {
      title: translate('specialtiesTitle'),
      description: translate('specialtiesDescription'),
      legend: translate('specialtiesLegend'),
      required: translate('specialtiesRequired'),
    },
    contact: {
      title: translate('contactTitle'),
      description: translate('contactDescription'),
      firstName: translate('firstName'),
      lastName: translate('lastName'),
      email: translate('email'),
      role: translate('role'),
      rolePrompt: translate('rolePrompt'),
      roleLabels: {
        'Medical Director': translate('medicalDirector'),
        'Clinic Management': translate('clinicManagement'),
        'International Office': translate('internationalOffice'),
      },
      privacy: translate('privacy'),
    },
    confirmation: translate('confirmation'),
    context: {
      details: {
        title: translate('detailsAsideTitle'),
        description: translate('detailsAsideDescription'),
      },
      specialties: {
        title: translate('specialtiesAsideTitle'),
        description: translate('specialtiesAsideDescription'),
      },
      contact: {
        title: translate('reviewContact'),
        description: translate('reviewContactDescription'),
        phone: translate('supportPhone'),
        email: translate('supportEmail'),
        office: translate('supportOffice'),
        country: translate('supportCountry'),
      },
      summary: {
        title: translate('summaryTitle'),
        description: translate('summaryDescription'),
        clinic: translate('summaryClinic'),
        specialties: translate('summarySpecialties'),
        emptySpecialties: translate('summaryNoSpecialties'),
        contact: translate('summaryContact'),
      },
    },
    validation,
    fieldErrors: {
      nameRequired: fieldError(1, 'clinicName', validation.clinicName.valueMissing),
      nameTooLong: fieldError(1, 'clinicName', translate('nameTooLong')),
      websiteInvalid: fieldError(1, 'clinicWebsite', validation.clinicWebsite.typeMismatch),
      firstNameRequired: fieldError(3, 'contactFirstName', validation.contactFirstName.valueMissing),
      firstNameTooLong: fieldError(3, 'contactFirstName', translate('firstNameTooLong')),
      lastNameRequired: fieldError(3, 'contactLastName', validation.contactLastName.valueMissing),
      lastNameTooLong: fieldError(3, 'contactLastName', translate('lastNameTooLong')),
      emailInvalid: fieldError(3, 'contactEmail', validation.contactEmail.typeMismatch),
      roleInvalid: fieldError(3, 'contactRole', validation.contactRole.valueMissing),
      specialtiesInvalid: fieldError(2, 'treatmentCategories', translate('specialtiesInvalid')),
    },
    failure: translate('failure'),
  }
}

export type ClinicApplicationCopy = ReturnType<typeof buildClinicApplicationCopy>
