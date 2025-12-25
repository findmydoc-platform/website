import React from 'react'
import Image from 'next/image'
import { Facebook, Instagram, Twitter } from 'lucide-react'

import { Container } from '@/components/molecules/Container'
import { clinicHeroData } from '@/stories/fixtures/clinics'

export const ClinicHero: React.FC = () => {
  const { title, description, image } = clinicHeroData

  return (
    <section className="relative flex min-h-[768px] items-center justify-center overflow-hidden bg-white py-20">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <Image src={image} alt="Hero Background" fill className="object-cover object-center" priority />
        <div className="absolute inset-0 bg-white/75" />
      </div>

      <Container className="relative z-10 flex flex-col items-center text-center">
        <h1 className="mb-8 max-w-4xl text-5xl font-bold leading-tight text-foreground md:text-7xl">{title}</h1>
        <p className="mb-12 max-w-2xl text-xl text-foreground/80 md:text-2xl">{description}</p>

        <div className="flex space-x-6">
          <a href="#" className="text-foreground transition-colors hover:text-primary">
            <Facebook className="h-8 w-8" />
            <span className="sr-only">Facebook</span>
          </a>
          <a href="#" className="text-foreground transition-colors hover:text-primary">
            <Twitter className="h-8 w-8" />
            <span className="sr-only">Twitter</span>
          </a>
          <a href="#" className="text-foreground transition-colors hover:text-primary">
            <Instagram className="h-8 w-8" />
            <span className="sr-only">Instagram</span>
          </a>
        </div>

        <div className="mt-16 animate-bounce">
          {/* Scroll down indicator if needed, design shows a path/arrow */}
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 rotate-90 text-foreground"
          >
            <path
              d="M9 18L15 12L9 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </Container>
    </section>
  )
}
