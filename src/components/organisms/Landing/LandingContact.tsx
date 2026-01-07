import React from 'react'
import Image from 'next/image'

import { Container } from '@/components/molecules/Container'
import ph1440x464 from '@/stories/assets/placeholder-1440-464.svg'

export const LandingContact: React.FC = () => {
  return (
    <section className="relative min-h-116 overflow-hidden bg-white py-20">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <Image src={ph1440x464} alt="Contact Background" fill className="object-cover object-center" />
        <div className="absolute inset-0 bg-white/70" />
      </div>

      <Container className="relative z-10">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <h2 className="text-foreground mb-6 text-5xl font-bold">Contact</h2>
            <p className="text-foreground max-w-md text-2xl leading-relaxed font-bold">
              Ex sea causae dolores, nam et doming dicunt feugait scripta aperiri postulant sed affert audire, no
              alienum quaestio mea.
            </p>
          </div>

          <div className="flex min-h-75 items-center justify-center rounded-lg bg-white p-8 shadow-lg">
            <p className="text-foreground text-center text-4xl">Placeholder for a funnel goes here</p>
          </div>
        </div>
      </Container>
    </section>
  )
}
