import * as React from 'react'

import { cn } from '@/utilities/ui'

import { RelatedDoctorCarousel, type RelatedDoctorCarouselProps } from './RelatedDoctorSection.client'

export type RelatedDoctorSectionProps = RelatedDoctorCarouselProps

export function RelatedDoctorSection({ title = 'Related Doctor', className, ...props }: RelatedDoctorSectionProps) {
  return (
    <section className={cn('w-full', className)}>
      <div className="container-content px-4 sm:px-6 lg:px-0">
        <RelatedDoctorCarousel title={title} {...props} />
      </div>
    </section>
  )
}
