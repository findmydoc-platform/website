import type { Metadata } from 'next'
import { headers } from 'next/headers'

import { readTemporaryLandingLocale } from '@/features/temporaryLandingMode'
import { generateFullHomeMetadata, renderFullHome } from './_data/fullHome'
import { generateHoldingHomeMetadata, renderHoldingHome, type HoldingHomeSearchParams } from './_data/holdingHome'

export default async function Home({
  searchParams: searchParamsPromise,
}: {
  searchParams?: Promise<HoldingHomeSearchParams>
}) {
  const holdingLocale = readTemporaryLandingLocale(await headers())
  if (holdingLocale) return renderHoldingHome(holdingLocale, await searchParamsPromise)

  return renderFullHome('de')
}

export async function generateMetadata(): Promise<Metadata> {
  const holdingLocale = readTemporaryLandingLocale(await headers())
  if (holdingLocale) return generateHoldingHomeMetadata(holdingLocale)

  return generateFullHomeMetadata('de')
}
