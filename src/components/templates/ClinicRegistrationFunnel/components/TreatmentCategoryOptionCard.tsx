import { Check } from 'lucide-react'

import { cn } from '@/utilities/ui'
import type { ResolvedTreatmentCategory } from '../types'

export function TreatmentCategoryOptionCard({
  category,
  isSelected,
  onToggle,
}: {
  category: ResolvedTreatmentCategory
  isSelected: boolean
  onToggle: (categoryId: string) => void
}) {
  const Icon = category.icon

  return (
    <button
      aria-pressed={isSelected}
      className={cn(
        'relative flex h-[100px] min-w-0 flex-col items-center justify-center gap-2 rounded-[8px] border border-slate-300 bg-card px-2 text-sm font-semibold text-[#172033] transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-hidden',
        isSelected && 'border-primary bg-primary/5',
      )}
      onClick={() => onToggle(category.id)}
      type="button"
    >
      {isSelected ? (
        <span className="absolute top-2 right-2 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
          <Check aria-hidden="true" className="size-3.5" />
        </span>
      ) : null}
      <Icon aria-hidden="true" className="size-8 text-primary" />
      <span className="max-w-full text-center leading-4 break-words">{category.label}</span>
    </button>
  )
}
