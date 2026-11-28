import Link from 'next/link'
import React from 'react'
import { headers } from 'next/headers'

import { publicPageLocaleFromPath } from '@/i18n/publicNavigationPath'
import { FRONTEND_PATH_HEADER } from '@/i18n/requestLocale'
import { getPublicErrorCopy } from '@/features/uiCopy/publicErrors'

import { Button } from '@/components/atoms/button'
import { Heading } from '@/components/atoms/Heading'
import { Container } from '@/components/molecules/Container'

export default async function NotFound() {
  const pathname = (await headers()).get(FRONTEND_PATH_HEADER) ?? '/'
  const locale = publicPageLocaleFromPath(pathname)
  const copy = getPublicErrorCopy(locale)

  return (
    <Container className="py-16 sm:py-28" lang={locale}>
      <div className="prose max-w-none">
        <Heading as="h1" align="left" className="mb-0">
          404
        </Heading>
        <p className="mb-4">{copy.notFound}</p>
      </div>
      <Button asChild variant="default">
        <Link href="/">{copy.home}</Link>
      </Button>
    </Container>
  )
}
