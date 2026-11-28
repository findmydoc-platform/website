export type ClinicRegistrationFormValues = {
  clinicName: string
  clinicWebsite: string
  contactEmail: string
  contactFirstName: string
  contactLastName: string
  contactRole: string
}

export type ClinicRegistrationSubmitData = ClinicRegistrationFormValues & {
  medicalSpecialties: string[]
}

export type ClinicRegistrationFailure =
  | 'nameRequired'
  | 'nameTooLong'
  | 'websiteInvalid'
  | 'firstNameRequired'
  | 'firstNameTooLong'
  | 'lastNameRequired'
  | 'lastNameTooLong'
  | 'emailInvalid'
  | 'roleInvalid'
  | 'specialtiesInvalid'
  | 'failed'
