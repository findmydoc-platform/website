import { Check } from 'lucide-react'

import { cn } from '@/utilities/ui'
import type { ClinicRegistrationFunnelVariant, ResolvedTreatmentCategory } from '../types'

export function TreatmentCategoryOptionCard({
  category,
  isSelected,
  onToggle,
  variant = 'default',
}: {
  category: ResolvedTreatmentCategory
  isSelected: boolean
  onToggle: (categoryId: string) => void
  variant?: ClinicRegistrationFunnelVariant
}) {
  const Icon = category.icon
  const isLanding = variant === 'landing'

  return (
    <button
      aria-pressed={isSelected}
      className={cn(
        'relative flex h-[100px] min-w-0 flex-col items-center justify-center gap-2 border px-2 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden',
        isLanding
          ? 'rounded-2xl border-slate-200 bg-white/95 text-foreground shadow-sm focus-visible:ring-[#0d6b59]/70'
          : 'rounded-[8px] border-slate-300 bg-card text-[#172033] focus-visible:ring-primary',
        isSelected &&
          (isLanding
            ? 'border-[#0d6b59] bg-accent/20 shadow-[0_16px_36px_-28px_rgba(13,107,89,0.55)]'
            : 'border-primary bg-primary/5'),
      )}
      onClick={() => onToggle(category.id)}
      type="button"
    >
      {isSelected ? (
        <span
          className={cn(
            'absolute top-2 right-2 grid size-5 place-items-center rounded-full',
            isLanding ? 'bg-[#0d6b59] text-white' : 'bg-primary text-primary-foreground',
          )}
        >
          <Check aria-hidden="true" className="size-3.5" />
        </span>
      ) : null}
      <Icon aria-hidden="true" className={cn('size-8', isLanding ? 'text-[#0d6b59]' : 'text-primary')} />
      <span className="max-w-full text-center leading-4 break-words">{category.label}</span>
    </button>
  )
}
