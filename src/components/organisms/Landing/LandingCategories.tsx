import React from 'react'
import Image from 'next/image'

import { Container } from '@/components/molecules/Container'
import { cn } from '@/utilities/ui'

type LandingCategoriesProps = {
  categories: { name: string; active?: boolean }[]
  images: { src: string; alt: string; size?: string }[]
}

export const LandingCategories: React.FC<LandingCategoriesProps> = ({ categories, images }) => {
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
          {categories.map((category, index) => (
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
          <div className="relative h-[34rem] overflow-hidden rounded-xl md:row-span-2">
            {images[0] && (
              <Image
                src={images[0].src}
                alt={images[0].alt}
                fill
                className="object-cover transition-transform duration-300 hover:scale-105"
              />
            )}
          </div>

          {/* Second medium item */}
          <div className="relative h-64 overflow-hidden rounded-xl">
            {images[1] && (
              <Image
                src={images[1].src}
                alt={images[1].alt}
                fill
                className="object-cover transition-transform duration-300 hover:scale-105"
              />
            )}
          </div>

          {/* Bottom row with two small items */}
          <div className="grid gap-6 md:grid-cols-2">
            <div className="relative h-64 overflow-hidden rounded-xl">
              {images[2] && (
                <Image
                  src={images[2].src}
                  alt={images[2].alt}
                  fill
                  className="object-cover transition-transform duration-300 hover:scale-105"
                />
              )}
            </div>
            <div className="relative h-64 overflow-hidden rounded-xl">
              {images[3] && (
                <Image
                  src={images[3].src}
                  alt={images[3].alt}
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
