import type { Metadata } from 'next'
import { draftMode } from 'next/headers'
import { notFound } from 'next/navigation'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { ClinicDetail } from '@/components/templates/ClinicDetailConcepts'
import { getClinicDetailServerData } from '@/utilities/clinicDetail/serverData'

type ClinicDetailPageArgs = {
  params: Promise<{
    slug: string
  }>
}

export const dynamic = 'force-dynamic'

export default async function ClinicDetailPage({ params: paramsPromise }: ClinicDetailPageArgs) {
  const { slug } = await paramsPromise
  const { isEnabled: draft } = await draftMode()
  const payload = await getPayload({ config: configPromise })

  const clinicDetailData = await getClinicDetailServerData(payload, slug, {
    draft,
  })

  if (!clinicDetailData) {
    notFound()
  }

  return <ClinicDetail data={clinicDetailData} />
}

export async function generateMetadata({ params: paramsPromise }: ClinicDetailPageArgs): Promise<Metadata> {
  const { slug } = await paramsPromise
  const { isEnabled: draft } = await draftMode()
  const payload = await getPayload({ config: configPromise })

  const clinicDetailData = await getClinicDetailServerData(payload, slug, {
    draft,
  })

  if (!clinicDetailData) {
    return {
      title: 'Clinic Profile | findmydoc',
    }
  }

  return {
    title: `${clinicDetailData.clinicName} | findmydoc`,
    description: clinicDetailData.description,
  }
}
