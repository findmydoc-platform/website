export const CLINIC_DASHBOARD_CONTRACT_HEADER = 'X-Findmydoc-Clinic-Dashboard-Contract'
export const CLINIC_DASHBOARD_INQUIRY_CONTRACT_V1 = 'inquiry-communication-v1'
export const CLINIC_DASHBOARD_INQUIRY_CONTRACT_V2 = 'inquiry-communication-v2'

export type ClinicDashboardContract = 'inquiry' | 'legacy'
export type ClinicDashboardInquiryContractVersion = 'v1' | 'v2'

export const resolveClinicDashboardInquiryContractVersion = (
  headers: Headers,
): ClinicDashboardInquiryContractVersion | 'invalid' | 'legacy' => {
  const value = headers.get(CLINIC_DASHBOARD_CONTRACT_HEADER)
  if (value === null) return 'legacy'
  if (value === CLINIC_DASHBOARD_INQUIRY_CONTRACT_V1) return 'v1'
  if (value === CLINIC_DASHBOARD_INQUIRY_CONTRACT_V2) return 'v2'
  return 'invalid'
}

export const resolveClinicDashboardContract = (headers: Headers): ClinicDashboardContract | 'invalid' => {
  const version = resolveClinicDashboardInquiryContractVersion(headers)
  if (version === 'legacy' || version === 'invalid') return version
  return 'inquiry'
}
