import * as React from 'react'
import { Facebook, Instagram, Linkedin, Twitter } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/utilities/ui'

const socialLinkVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ring-offset-background',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        outline: 'border border-foreground text-foreground hover:bg-primary/5',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
      },
      size: {
        default: 'h-8 w-8 rounded-full',
        sm: 'h-6 w-6 rounded-full',
        lg: 'h-10 w-10 rounded-full',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

const Icons = {
  facebook: Facebook,
  twitter: Twitter,
  instagram: Instagram,
  linkedin: Linkedin,
}

export interface SocialLinkProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement>, VariantProps<typeof socialLinkVariants> {
  platform?: keyof typeof Icons
}

export function SocialLink({ className, variant, size, platform, children, ...props }: SocialLinkProps) {
  const Icon = platform ? Icons[platform] : null

  return (
    <a
      className={cn(socialLinkVariants({ variant, size, className }))}
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    >
      {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : children}
    </a>
  )
}
