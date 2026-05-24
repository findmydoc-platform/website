export const normalizeAllowedDevOrigin = (value) => {
  if (!value) return null

  const normalized = value.trim()
  if (!normalized) return null

  try {
    const originUrl = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(normalized) ? normalized : `http://${normalized}`)
    return originUrl.hostname.toLowerCase()
  } catch {
    const [hostname] = normalized.split('/')
    return hostname?.replace(/:\d+$/, '').trim().toLowerCase() || null
  }
}

export const isPrivateIpv4Address = (address) => {
  const octets = address.split('.').map(Number)

  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return false
  }

  const [first, second] = octets

  return first === 10 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168)
}

export const getLocalIpv4DevOrigins = (networkInterfacesByName) =>
  Object.values(networkInterfacesByName)
    .flatMap((interfaces) => interfaces ?? [])
    .filter(
      (networkInterface) =>
        (networkInterface.family === 'IPv4' || networkInterface.family === 4) &&
        !networkInterface.internal &&
        isPrivateIpv4Address(networkInterface.address),
    )
    .map((networkInterface) => networkInterface.address)

export const getConfiguredDevOrigins = (value) =>
  (value ?? '').split(',').map(normalizeAllowedDevOrigin).filter(Boolean)

export const getAllowedDevOrigins = ({ configuredOrigins, isDevelopmentRuntime, networkInterfacesByName }) => {
  if (!isDevelopmentRuntime) return []

  return Array.from(
    new Set([...getLocalIpv4DevOrigins(networkInterfacesByName), ...getConfiguredDevOrigins(configuredOrigins)]),
  )
}
