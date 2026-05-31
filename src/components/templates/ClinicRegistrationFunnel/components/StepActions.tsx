import { ArrowLeft, ArrowRight } from 'lucide-react'

import { Button } from '@/components/atoms/button'
import { cn } from '@/utilities/ui'
import type { ClinicRegistrationFunnelVariant } from '../types'

export function StepActions({
  onBack,
  onNext,
  primaryLabel,
  primaryType = 'button',
  variant = 'default',
}: {
  onBack?: () => void
  onNext?: () => void
  primaryLabel: string
  primaryType?: 'button' | 'submit'
  variant?: ClinicRegistrationFunnelVariant
}) {
  const isLanding = variant === 'landing'
  const primaryClassName = cn(
    'h-[56px] w-full text-base leading-none font-semibold sm:h-[60px] sm:text-[19px]',
    isLanding
      ? 'rounded-full bg-accent text-[#063d34] shadow-[0_16px_34px_-22px_rgba(66,226,183,0.9)] hover:bg-[#35d4aa] sm:text-base'
      : 'rounded-[8px] shadow-[0_9px_20px_rgba(0,118,255,0.22)]',
  )

  if (!onBack) {
    return (
      <div className="mx-auto mt-auto w-full max-w-[490px] pt-6 sm:pt-10 lg:pt-12">
        <Button className={primaryClassName} onClick={primaryType === 'button' ? onNext : undefined} type={primaryType}>
          {primaryLabel}
          <ArrowRight aria-hidden="true" className="size-5" />
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto mt-auto grid w-full max-w-[490px] gap-4 pt-6 sm:grid-cols-2 sm:items-center sm:pt-10 lg:pt-12">
      <Button
        className={cn(
          'min-h-11 justify-self-start text-card-foreground/80',
          isLanding ? 'rounded-full px-4 text-[#0d6b59] hover:bg-accent/25 hover:text-[#095747]' : 'px-0',
        )}
        onClick={onBack}
        type="button"
        variant="ghost"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back
      </Button>
      <Button
        className={cn(primaryClassName, 'min-w-0 whitespace-normal')}
        onClick={primaryType === 'button' ? onNext : undefined}
        type={primaryType}
      >
        {primaryLabel}
        <ArrowRight aria-hidden="true" className="size-5" />
      </Button>
    </div>
  )
}
