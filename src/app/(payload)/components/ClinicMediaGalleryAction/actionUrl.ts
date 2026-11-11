export function clinicMediaGalleryActionUrl(apiURL: string, origin: string): string {
  const url = new URL(apiURL, origin)
  url.pathname = `${url.pathname.replace(/\/$/u, '')}/profile-gallery`
  return url.toString()
}
