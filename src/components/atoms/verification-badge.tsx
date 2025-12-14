import * as React from 'react'
import { BadgeCheck, BadgeX } from 'lucide-react'
import { type VariantProps, cva } from 'class-variance-authority'

import { cn } from '@/utilities/ui'

const verificationBadgeVariants = cva(
  'inline-flex items-center gap-1 rounded-md px-3 py-1 text-xs font-semibold leading-4 w-20 justify-center',
  {
    defaultVariants: {
      variant: 'unverified',
    },
    variants: {
      variant: {
        unverified: 'bg-primary text-primary-foreground',
        bronze: 'bg-verification-bronze text-verification-bronze-foreground',
        silver: 'bg-verification-silver text-verification-silver-foreground',
        gold: 'bg-verification-gold text-verification-gold-foreground',
      },
    },
  },
)

export type VerificationBadgeVariant = NonNullable<VariantProps<typeof verificationBadgeVariants>['variant']>

export type VerificationBadgeProps = Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> &
  VariantProps<typeof verificationBadgeVariants> & {
    icon?: 'auto' | 'none'
  }

const verificationBadgeLabels: Record<VerificationBadgeVariant, string> = {
  unverified: 'unverified',
  bronze: 'bronze',
  silver: 'silver',
  gold: 'gold',
}

export function VerificationBadge({ className, variant, icon = 'auto', ...props }: VerificationBadgeProps) {
  const Icon = variant === 'unverified' ? BadgeX : BadgeCheck

  return (
    <span className={cn(verificationBadgeVariants({ variant, className }))} {...props}>
      {icon === 'none' ? null : <Icon className="size-3" aria-hidden="true" />}
      <span>{verificationBadgeLabels[variant ?? 'unverified']}</span>
    </span>
  )
}
