import Link from 'next/link'
import React from 'react'
import { headers } from 'next/headers'

import { publicPageLocaleFromPath } from '@/i18n/publicNavigationPath'
import { FRONTEND_PATH_HEADER } from '@/i18n/requestLocale'
import { getPublishedNavigationPageSlugs } from './_data/holdingLegalLinks'
import { isTemporaryLandingModeRequest } from '@/features/temporaryLandingMode'
import { getPublicErrorCopy } from '@/features/uiCopy/publicErrors'

import { Button } from '@/components/atoms/button'
import { Heading } from '@/components/atoms/Heading'
import { Container } from '@/components/molecules/Container'

export default async function NotFound() {
  const requestHeaders = await headers()
  const pathname = requestHeaders.get(FRONTEND_PATH_HEADER) ?? '/'
  const locale = publicPageLocaleFromPath(pathname)
  const copy = getPublicErrorCopy(locale)
  const englishHomeAvailable =
    locale === 'en' &&
    (isTemporaryLandingModeRequest(requestHeaders) || (await getPublishedNavigationPageSlugs('en')).includes('home'))
  const homeHref = englishHomeAvailable ? '/en' : '/'

  return (
    <Container className="py-16 sm:py-28" lang={locale}>
      <div className="prose max-w-none">
        <Heading as="h1" align="left" className="mb-0">
          404
        </Heading>
        <p className="mb-4">{copy.notFound}</p>
      </div>
      <Button asChild variant="default">
        <Link href={homeHref}>{copy.home}</Link>
      </Button>
    </Container>
  )
}
