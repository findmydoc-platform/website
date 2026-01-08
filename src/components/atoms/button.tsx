import { cn } from '@/utilities/ui'
import { Slot } from '@radix-ui/react-slot'
import { type VariantProps, cva } from 'class-variance-authority'
import * as React from 'react'

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 rounded-lg',
  {
    defaultVariants: {
      size: 'default',
      variant: 'default',
      hoverEffect: 'default',
    },
    variants: {
      size: {
        clear: '',
        default: 'h-10 px-6 py-2',
        icon: 'h-10 w-10 rounded-full',
        lg: 'h-12 px-8 ',
        sm: 'h-8 px-4',
        xs: 'h-6 px-2',
      },
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        primary: 'bg-primary text-primary-foreground hover:bg-primary/80 focus-visible:ring-ring',
        secondary:
          'border border-primary/30 bg-card text-primary hover:border-primary hover:bg-primary/5 focus-visible:ring-ring',
        accent: 'bg-accent text-accent-foreground hover:bg-accent/80 focus-visible:ring-ring',
        filter:
          'border bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:text-secondary-foreground focus-visible:ring-ring',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        ghost: 'hover:bg-card hover:text-accent-foreground',
        link: 'text-primary items-start justify-start underline-offset-4 hover:underline',
        outline: 'border border-border bg-background hover:bg-card hover:text-accent-foreground',
        brandOutlineThick: 'border-2 border-primary bg-background text-primary hover:bg-primary/5',
      },
      hoverEffect: {
        default: '',
        wave: '',
        slideFill: '',
        none: '',
      },
    },
    compoundVariants: [
      {
        variant: 'primary',
        hoverEffect: 'wave',
        className: 'btn-hover-wave',
      },
      {
        variant: 'secondary',
        hoverEffect: 'slideFill',
        className: 'btn-hover-slideFill',
      },
      {
        variant: 'outline',
        hoverEffect: 'slideFill',
        className: 'btn-hover-slideFill',
      },
      {
        variant: 'brandOutlineThick',
        hoverEffect: 'slideFill',
        className: 'btn-hover-slideFill',
      },
    ],
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ asChild = false, className, size, variant, hoverEffect, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return <Comp className={cn(buttonVariants({ size, variant, hoverEffect, className }))} ref={ref} {...props} />
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
