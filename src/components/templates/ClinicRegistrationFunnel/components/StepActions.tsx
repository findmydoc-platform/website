import { ArrowLeft, ArrowRight } from 'lucide-react'

import { Button } from '@/components/atoms/button'

export function StepActions({
  onBack,
  onNext,
  primaryLabel,
  primaryType = 'button',
}: {
  onBack?: () => void
  onNext?: () => void
  primaryLabel: string
  primaryType?: 'button' | 'submit'
}) {
  if (!onBack) {
    return (
      <div className="mx-auto mt-auto w-full max-w-[490px] pt-6 sm:pt-10 lg:pt-12">
        <Button
          className="h-[56px] w-full rounded-[8px] text-base leading-none font-semibold shadow-[0_9px_20px_rgba(0,118,255,0.22)] sm:h-[60px] sm:text-[19px]"
          onClick={primaryType === 'button' ? onNext : undefined}
          type={primaryType}
        >
          {primaryLabel}
          <ArrowRight aria-hidden="true" className="size-5" />
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto mt-auto grid w-full max-w-[490px] gap-4 pt-6 sm:grid-cols-2 sm:items-center sm:pt-10 lg:pt-12">
      <Button
        className="min-h-11 justify-self-start px-0 text-card-foreground/80"
        onClick={onBack}
        type="button"
        variant="ghost"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Zurück
      </Button>
      <Button
        className="h-[56px] w-full min-w-0 rounded-[8px] text-base leading-none font-semibold whitespace-normal shadow-[0_9px_20px_rgba(0,118,255,0.22)] sm:h-[60px] sm:text-[19px]"
        onClick={primaryType === 'button' ? onNext : undefined}
        type={primaryType}
      >
        {primaryLabel}
        <ArrowRight aria-hidden="true" className="size-5" />
      </Button>
    </div>
  )
}
