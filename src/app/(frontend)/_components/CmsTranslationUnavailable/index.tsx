import Link from 'next/link'

import { Button } from '@/components/atoms/button'
import { Heading } from '@/components/atoms/Heading'
import { Container } from '@/components/molecules/Container'
import { CmsLanguageSwitchRoute } from '@/features/languageSwitch/CmsLanguageSwitchRoute.client'
import { languageSwitcherCopy } from '@/features/languageSwitch/copy'
import { CmsDocumentLanguage } from '@/features/uiCopy/DocumentLanguage.client'

export function CmsTranslationUnavailable({ germanPath }: { germanPath: string }) {
  return (
    <Container className="space-y-6 py-8 sm:py-12" lang="en">
      <CmsDocumentLanguage locale="en" />
      <CmsLanguageSwitchRoute locale="en" targets={{ de: germanPath }} />
      <Heading as="h1" size="h3" align="left">
        {languageSwitcherCopy.en.unavailable}
      </Heading>
      <Button asChild size="lg" className="hover:bg-primary-hover">
        <Link href={germanPath} hrefLang="de" lang="de" prefetch={false}>
          Auf Deutsch lesen
        </Link>
      </Button>
    </Container>
  )
}
