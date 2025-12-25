import React from 'react'
import Image from 'next/image'

import { Container } from '@/components/molecules/Container'
import { clinicCategoriesData, clinicCategoryImages } from '@/stories/fixtures/clinics'
import { cn } from '@/utilities/ui'

export const ClinicCategories: React.FC = () => {
  return (
    <section className="bg-muted/30 py-20">
      <Container>
        <div className="mb-12 text-center">
          <h2 className="mb-6 text-5xl font-bold text-foreground">Our Categories</h2>
          <p className="mx-auto max-w-2xl text-xl text-foreground/80">
            Quidam officiis similique sea ei, vel tollit indoctum efficiendi ei, at nihil tantas platonem eos.
          </p>
        </div>

        <div className="mb-12 flex flex-wrap justify-center gap-8">
          {clinicCategoriesData.map((category, index) => (
            <button
              key={index}
              className={cn(
                'text-lg font-medium transition-colors hover:text-primary',
                category.active ? 'text-foreground font-bold' : 'text-muted-foreground',
              )}
            >
              {category.name}
            </button>
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* First large item */}
          <div className="relative h-[544px] overflow-hidden rounded-[20px] md:row-span-2">
            {clinicCategoryImages[0] && (
              <Image
                src={clinicCategoryImages[0].src}
                alt={clinicCategoryImages[0].alt}
                fill
                className="object-cover transition-transform duration-300 hover:scale-105"
              />
            )}
          </div>

          {/* Second medium item */}
          <div className="relative h-[256px] overflow-hidden rounded-[20px]">
            {clinicCategoryImages[1] && (
              <Image
                src={clinicCategoryImages[1].src}
                alt={clinicCategoryImages[1].alt}
                fill
                className="object-cover transition-transform duration-300 hover:scale-105"
              />
            )}
          </div>

          {/* Bottom row with two small items */}
          <div className="grid gap-6 md:grid-cols-2">
            <div className="relative h-[256px] overflow-hidden rounded-[20px]">
              {clinicCategoryImages[2] && (
                <Image
                  src={clinicCategoryImages[2].src}
                  alt={clinicCategoryImages[2].alt}
                  fill
                  className="object-cover transition-transform duration-300 hover:scale-105"
                />
              )}
            </div>
            <div className="relative h-[256px] overflow-hidden rounded-[20px]">
              {clinicCategoryImages[3] && (
                <Image
                  src={clinicCategoryImages[3].src}
                  alt={clinicCategoryImages[3].alt}
                  fill
                  className="object-cover transition-transform duration-300 hover:scale-105"
                />
              )}
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}
