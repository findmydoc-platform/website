import { isNotNull, isRecord, resolveHrefFromCMSLink } from '@/blocks/_shared/utils'
import type { UiLinkProps } from '@/components/molecules/Link'

export function normalizeNavItems(
  data: { navItems?: Array<{ link?: unknown }> | null } | null | undefined,
): UiLinkProps[] {
  return (data?.navItems ?? [])
    .map((item) => {
      const link = item?.link

      const href = isRecord(link)
        ? resolveHrefFromCMSLink({
            type: typeof link.type === 'string' ? (link.type as 'custom' | 'reference') : null,
            url: typeof link.url === 'string' ? link.url : null,
            reference: link.reference,
          })
        : undefined
      if (!href) return null

      return {
        href,
        label: isRecord(link) && typeof link.label === 'string' ? link.label : null,
        newTab: isRecord(link) && typeof link.newTab === 'boolean' ? link.newTab : false,
        appearance: 'inline',
      } satisfies UiLinkProps
    })
    .filter(isNotNull)
}
