export const CLINIC_DASHBOARD_CONTRACT_HEADER = 'X-Findmydoc-Clinic-Dashboard-Contract'
export const CLINIC_DASHBOARD_INQUIRY_CONTRACT = 'inquiry-communication-v1'

export type ClinicDashboardContract = 'inquiry' | 'legacy'

export const resolveClinicDashboardContract = (headers: Headers): ClinicDashboardContract | 'invalid' => {
  const value = headers.get(CLINIC_DASHBOARD_CONTRACT_HEADER)
  if (value === null) return 'legacy'
  return value === CLINIC_DASHBOARD_INQUIRY_CONTRACT ? 'inquiry' : 'invalid'
}
