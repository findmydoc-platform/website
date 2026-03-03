import * as React from 'react'

import { Media } from '@/components/molecules/Media'
import { cn } from '@/utilities/ui'

import type { ClinicDetailDoctor } from '@/components/templates/ClinicDetailConcepts/types'

type DoctorPreviewListItemProps = {
  doctor: ClinicDetailDoctor
  selected: boolean
  ratingText: string
  onSelect: () => void
}

export function DoctorPreviewListItem({ doctor, selected, ratingText, onSelect }: DoctorPreviewListItemProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`Select ${doctor.name}`}
      className={cn(
        'grid w-full cursor-pointer grid-cols-[56px_1fr] items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors',
        selected ? 'bg-primary/10' : 'hover:bg-primary/5',
      )}
    >
      <div className="relative size-14 overflow-hidden rounded-full">
        <Media
          htmlElement={null}
          src={doctor.image.src}
          alt={doctor.image.alt}
          fill
          imgClassName="object-cover"
          size="56px"
        />
      </div>

      <div className="min-w-0">
        <p className="truncate text-base font-semibold text-secondary">{doctor.name}</p>
        <p className="truncate text-xs text-secondary/60">{doctor.specialty}</p>
        <p className="truncate text-[11px] text-secondary/45">{ratingText}</p>
      </div>
    </button>
  )
}
