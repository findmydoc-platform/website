import type * as React from 'react'
import { ShieldCheck } from 'lucide-react'

import { Heading } from '@/components/atoms/Heading'
import { cn } from '@/utilities/ui'
import type { ClinicRegistrationFunnelVariant } from '../types'

export function ReviewConfirmationStep({
  headingRef,
  variant = 'default',
}: {
  headingRef: React.Ref<HTMLHeadingElement>
  variant?: ClinicRegistrationFunnelVariant
}) {
  const isLanding = variant === 'landing'

  return (
    <div
      className={cn(
        'mx-auto flex w-full max-w-[490px] flex-1 flex-col items-center justify-center py-12 text-center',
        isLanding && 'py-10',
      )}
    >
      <div
        className={cn(
          'grid place-items-center rounded-full bg-accent',
          isLanding ? 'size-20 text-[#0d6b59]' : 'size-[88px] text-secondary',
        )}
      >
        <ShieldCheck aria-hidden="true" className="size-10" />
      </div>
      <Heading
        align="center"
        as="h2"
        className={cn('mt-5 text-[34px] leading-tight', isLanding ? 'text-foreground' : 'text-[#172033]')}
        ref={headingRef}
        size="h3"
        tabIndex={-1}
      >
        Request submitted
      </Heading>
      <p className="mt-4 max-w-[430px] text-lg leading-relaxed text-card-foreground/70">
        Your request has been submitted. We will contact you once the review is complete.
      </p>
    </div>
  )
}
