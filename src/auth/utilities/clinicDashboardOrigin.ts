export const getClinicDashboardOrigin = (): string => {
  const configuredValue = process.env.CLINIC_DASHBOARD_URL?.trim()
  if (!configuredValue) {
    throw new Error('CLINIC_DASHBOARD_URL is not defined')
  }

  let url: URL
  try {
    url = new URL(configuredValue)
  } catch {
    throw new Error('CLINIC_DASHBOARD_URL must be an absolute HTTP(S) origin')
  }

  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error('CLINIC_DASHBOARD_URL must be an absolute HTTP(S) origin')
  }

  return url.origin
}
