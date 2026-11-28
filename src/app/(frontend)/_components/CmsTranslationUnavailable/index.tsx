import Link from 'next/link'

import { Button } from '@/components/atoms/button'
import type { BreadcrumbItem } from '@/components/molecules/Breadcrumb'
import { BlogHero } from '@/components/organisms/Blog/BlogHero'
import { CmsLanguageSwitchRoute } from '@/features/languageSwitch/CmsLanguageSwitchRoute.client'
import { CmsDocumentLanguage } from '@/features/uiCopy/DocumentLanguage.client'
import { getPublicErrorCopy } from '@/features/uiCopy/publicErrors'

const copy = getPublicErrorCopy('en')
export const cmsTranslationNoticeTitle = copy.germanAvailable

export function CmsTranslationUnavailable({
  germanPath,
  breadcrumbs,
}: {
  germanPath: string
  breadcrumbs?: BreadcrumbItem[]
}) {
  return (
    <div lang="en">
      <CmsDocumentLanguage locale="en" />
      <CmsLanguageSwitchRoute locale="en" targets={{ de: germanPath }} />
      <BlogHero
        title={cmsTranslationNoticeTitle}
        subtitle={null}
        breadcrumbs={breadcrumbs}
        action={
          <Button asChild size="lg" className="hover:bg-primary-hover">
            <Link href={germanPath} hrefLang="de" prefetch={false}>
              {copy.readGerman}
            </Link>
          </Button>
        }
      />
    </div>
  )
}
