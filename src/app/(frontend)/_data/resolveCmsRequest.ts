import { getCachedRedirects } from '@/utilities/getRedirects'
import { isTemporaryLandingIndexablePath } from '@/features/temporaryLandingMode'
import type { CmsRedirectSource } from '@/utilities/content/cmsRedirectPaths'
import type { CmsRedirectResult } from '@/utilities/routing/cmsRedirectRequest'
import { findPublicCmsCanonicalBySlug, resolveSameLocaleRedirectTargetPath } from './resolveRedirectTargetPath'

export async function resolveCmsRequest(
  pathname: string,
  source: CmsRedirectSource,
  holding: boolean,
): Promise<CmsRedirectResult | null> {
  const { collection, locale, slug } = source
  const allows = (path: string) => !holding || isTemporaryLandingIndexablePath(path)
  const rules = await getCachedRedirects()()
  const rule = rules.find((item) => item.from === pathname)

  // Manually configured temporary redirects still run in the page as before.
  if (rule && rule.type !== '301') return null
  const history = rule?.to?.type === 'reference' ? rule.to.reference : null
  if (!history && locale !== 'en') return null
  if (await findPublicCmsCanonicalBySlug(source)) return null

  if (history) {
    const destination = await resolveSameLocaleRedirectTargetPath(history, collection, locale)
    if (destination && destination !== pathname && allows(destination)) return { status: 301, path: destination }
    if (locale !== 'en' || destination) return null

    // A dormant system redirect identifies a URL that was public before withdrawal.
    const germanPath = await resolveSameLocaleRedirectTargetPath(history, collection, 'de')
    return germanPath && allows(germanPath) ? { status: 200, path: germanPath } : null
  }

  if (locale !== 'en') return null

  const germanSource = await findPublicCmsCanonicalBySlug({ collection, locale: 'de', slug })
  if (!germanSource || !allows(germanSource.path)) return null

  const englishPath = await resolveSameLocaleRedirectTargetPath(
    { relationTo: collection, value: germanSource.id },
    collection,
    'en',
  )
  if (!englishPath) return { status: 200, path: germanSource.path }
  return englishPath !== pathname && allows(englishPath) ? { status: 302, path: englishPath } : null
}
