import { getCachedRedirects } from '@/utilities/getRedirects'
import { isTemporaryLandingIndexablePath } from '@/features/temporaryLandingMode'
import type { CmsRedirectSource } from '@/utilities/content/cmsRedirectPaths'
import { resolveSameLocaleRedirectTargetPath } from './resolveRedirectTargetPath'

export async function resolveCmsPermanentRedirect(
  pathname: string,
  source: CmsRedirectSource,
  holding: boolean,
): Promise<string | null> {
  const rules = await getCachedRedirects()()
  const rule = rules.find((item) => item.type === '301' && item.from === pathname)
  if (rule?.to?.type !== 'reference' || !rule.to.reference) return null

  const destination = await resolveSameLocaleRedirectTargetPath(rule.to.reference, source)
  if (!destination || destination === pathname) return null
  return !holding || isTemporaryLandingIndexablePath(destination) ? destination : null
}
