import React from 'react'
import Image from 'next/image'

import { Container } from '@/components/molecules/Container'
import ph1440x464 from '@/stories/assets/placeholder-1440-464.svg'
import funnel900x300 from '@/stories/assets/funnel-900-300.svg'

export const LandingContact: React.FC = () => {
  return (
    <section className="relative min-h-116 overflow-hidden bg-white py-20">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <Image src={ph1440x464} alt="Contact Background" fill className="object-cover object-center" />
        <div className="absolute inset-0 bg-white/70" />
      </div>

      <Container className="relative z-10">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <h2 className="mb-6 text-left text-5xl font-bold text-foreground">Contact</h2>
            <p className="max-w-md text-2xl leading-relaxed font-bold text-foreground">
              Ex sea causae dolores, nam et doming dicunt feugait scripta aperiri postulant sed affert audire, no
              alienum quaestio mea.
            </p>
          </div>

          <div className="flex min-h-75 items-center justify-center rounded-lg bg-white shadow-lg lg:col-span-8">
            <Image
              src={funnel900x300}
              alt="Placeholder for a funnel goes here"
              width={900}
              height={300}
              className="h-auto max-w-full"
            />
          </div>
        </div>
      </Container>
    </section>
  )
}
