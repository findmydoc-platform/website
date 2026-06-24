import type { BreadcrumbItem } from '@/components/molecules/Breadcrumb'

import { buildBreadcrumbListJsonLd } from './breadcrumbs'
import { absoluteUrl, buildNodeId, cleanJsonLdNodes } from './internal'
import type { JsonLdNode } from './types'

export type ClinicDetailPageJsonLdInput = {
  breadcrumbs: BreadcrumbItem[]
  clinicName: string
  clinicSlug: string
  description?: string | null
  doctors: Array<{
    image: {
      src?: string | null
    }
    name: string
    specialty: string
  }>
  heroImage: {
    src?: string | null
  }
  location: {
    fullAddress?: string | null
  }
  treatments: Array<{
    name: string
  }>
}

export function buildClinicDetailPageJsonLd(data: ClinicDetailPageJsonLdInput): JsonLdNode[] {
  const path = `/clinics/${encodeURIComponent(data.clinicSlug)}`

  return cleanJsonLdNodes([
    buildBreadcrumbListJsonLd(data.breadcrumbs),
    {
      '@context': 'https://schema.org',
      '@id': buildNodeId(path, 'clinic'),
      '@type': 'MedicalClinic',
      address: data.location.fullAddress
        ? {
            '@type': 'PostalAddress',
            streetAddress: data.location.fullAddress,
          }
        : undefined,
      description: data.description,
      employee: data.doctors.map((doctor) => ({
        '@type': 'Physician',
        image: doctor.image.src ? absoluteUrl(doctor.image.src) : undefined,
        medicalSpecialty: doctor.specialty,
        name: doctor.name,
      })),
      image: data.heroImage.src ? absoluteUrl(data.heroImage.src) : undefined,
      name: data.clinicName,
      availableService: data.treatments.map((treatment) => ({
        '@type': 'MedicalProcedure',
        name: treatment.name,
      })),
      url: absoluteUrl(path),
    },
  ])
}
