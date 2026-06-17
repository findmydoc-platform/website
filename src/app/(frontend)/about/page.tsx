import type { Metadata } from 'next'

import { AboutPage } from '@/components/templates/AboutPage/Component'
import { createSiteMetadata } from '@/utilities/generateMeta'
import { getAboutLandingContent } from '@/utilities/landing/landingPageContent'

export const revalidate = 600

export default async function AboutRoute() {
  const content = await getAboutLandingContent()

  return <AboutPage hero={content.hero} why={content.why} team={content.team} transparency={content.transparency} />
}

export async function generateMetadata(): Promise<Metadata> {
  const metadata = (await getAboutLandingContent()).metadata

  return {
    ...createSiteMetadata({
      title: typeof metadata.title === 'string' ? metadata.title : null,
      description: metadata.description,
      path: '/about',
    }),
    alternates: {
      canonical: '/about',
    },
  }
}
