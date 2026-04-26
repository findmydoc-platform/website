import * as React from 'react'

import { cn } from '@/utilities/ui'

import { RelatedDoctorCarousel, type RelatedDoctorCarouselProps } from './RelatedDoctorSection.client'

export type RelatedDoctorSectionProps = RelatedDoctorCarouselProps

export function RelatedDoctorSection({ title = 'Related Doctor', className, ...props }: RelatedDoctorSectionProps) {
  return (
    <section className={cn('w-full overflow-x-clip', className)}>
      <div className="container-content box-border">
        <RelatedDoctorCarousel title={title} {...props} />
      </div>
    </section>
  )
}
