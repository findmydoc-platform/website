import * as React from 'react'
import { BadgeCheck, BadgeX } from 'lucide-react'
import { type VariantProps, cva } from 'class-variance-authority'

import { cn } from '@/utilities/ui'

const verificationBadgeVariants = cva(
  'inline-flex items-center gap-1 rounded-md px-3 py-1 text-xs font-semibold leading-4',
  {
    defaultVariants: {
      variant: 'notVerified',
    },
    variants: {
      variant: {
        notVerified: 'bg-primary text-primary-foreground',
        bronze: 'bg-verification-bronze text-verification-bronze-foreground',
        silver: 'bg-verification-silver text-verification-silver-foreground',
        gold: 'bg-verification-gold text-verification-gold-foreground',
      },
    },
  },
)

export type VerificationBadgeVariant = NonNullable<VariantProps<typeof verificationBadgeVariants>['variant']>

export type VerificationBadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof verificationBadgeVariants> & {
    icon?: 'auto' | 'none'
  }

export function VerificationBadge({ className, variant, icon = 'auto', children, ...props }: VerificationBadgeProps) {
  const Icon = variant === 'notVerified' ? BadgeX : BadgeCheck

  return (
    <span className={cn(verificationBadgeVariants({ variant, className }))} {...props}>
      {icon === 'none' ? null : <Icon className="size-3" aria-hidden="true" />}
      <span>{children}</span>
    </span>
  )
}
