import type * as React from 'react'
import { ShieldCheck } from 'lucide-react'

import { Heading } from '@/components/atoms/Heading'

export function ReviewConfirmationStep({ headingRef }: { headingRef: React.Ref<HTMLHeadingElement> }) {
  return (
    <div className="mx-auto flex w-full max-w-[490px] flex-1 flex-col items-center justify-center py-12 text-center">
      <div className="grid size-[88px] place-items-center rounded-full bg-accent text-secondary">
        <ShieldCheck aria-hidden="true" className="size-10" />
      </div>
      <Heading
        align="center"
        as="h2"
        className="mt-5 text-[34px] leading-tight text-[#172033]"
        ref={headingRef}
        size="h3"
        tabIndex={-1}
      >
        Anfrage übermittelt
      </Heading>
      <p className="mt-4 max-w-[430px] text-lg leading-relaxed text-card-foreground/70">
        Ihre Anfrage wurde übermittelt. Wir kontaktieren Sie, sobald die Prüfung abgeschlossen ist.
      </p>
    </div>
  )
}
