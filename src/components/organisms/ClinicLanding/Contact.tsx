import React from 'react'
import Image from 'next/image'

import { Container } from '@/components/molecules/Container'

export const ClinicContact: React.FC = () => {
  return (
    <section className="relative min-h-[464px] overflow-hidden bg-white py-20">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <Image
          src="https://placehold.co/1440x464"
          alt="Contact Background"
          fill
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-white/70" />
      </div>

      <Container className="relative z-10">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <h2 className="mb-6 text-5xl font-bold text-foreground">Kontakt</h2>
            <p className="max-w-md text-2xl font-bold leading-relaxed text-foreground">
              Ex sea causae dolores, nam et doming dicunt feugait scripta aperiri postulant sed affert audire, no
              alienum quaestio mea.
            </p>
          </div>

          <div className="flex min-h-[300px] items-center justify-center rounded-lg bg-white p-8 shadow-lg">
            <p className="text-center text-4xl text-foreground">Hier kommt ein Funnle hin</p>
          </div>
        </div>
      </Container>
    </section>
  )
}
