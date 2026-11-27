export const clinicApplicationWebsiteError = 'Enter a valid clinic website URL.'

export function validateClinicApplicationWebsite(value: unknown): true | string {
  const url = typeof value === 'string' ? URL.parse(value) : null
  if (!url || !['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.')) {
    return clinicApplicationWebsiteError
  }
  return true
}
