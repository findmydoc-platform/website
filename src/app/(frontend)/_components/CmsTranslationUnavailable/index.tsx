import Link from 'next/link'

import { Button } from '@/components/atoms/button'
import type { BreadcrumbItem } from '@/components/molecules/Breadcrumb'
import { BlogHero } from '@/components/organisms/Blog/BlogHero'
import { CmsLanguageSwitchRoute } from '@/features/languageSwitch/CmsLanguageSwitchRoute.client'
import { CmsDocumentLanguage } from '@/features/uiCopy/DocumentLanguage.client'

export const cmsTranslationNoticeTitle = 'This page is currently available in German.'

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
            <Link href={germanPath} hrefLang="de" lang="de" prefetch={false}>
              Auf Deutsch lesen
            </Link>
          </Button>
        }
      />
    </div>
  )
}
