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
        ghostWhite: 'border border-white text-white hover:bg-white/10',
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
    // Note: `before:content-[...]` is required for Tailwind pseudo-elements.
    compoundVariants: [
      {
        variant: 'primary',
        hoverEffect: 'wave',
        className: [
          'relative isolate overflow-hidden',

          "before:content-[''] before:absolute before:inset-0 before:-z-10",
          'before:bg-linear-to-r before:from-primary before:via-primary-hover before:to-primary',
          'before:scale-x-300 before:translate-x-0',
          'before:opacity-100 before:transition-transform before:duration-600 before:ease-in-out',
          'hover:before:-translate-x-2/2',
          'motion-reduce:before:transition-none',
        ].join(' '),
      },
      {
        variant: 'secondary',
        hoverEffect: 'slideFill',
        className: [
          'relative isolate overflow-hidden',
          "before:content-[''] before:absolute before:inset-0 before:-z-10 before:rounded-full before:bg-primary",
          'before:-translate-x-full before:transition-transform before:duration-500 before:ease-in-out',
          'hover:before:translate-x-0 focus-visible:before:translate-x-0',
          'hover:text-primary-foreground focus-visible:text-primary-foreground',
          'motion-reduce:before:transition-none motion-reduce:transition-none',
        ].join(' '),
      },
      {
        variant: 'outline',
        hoverEffect: 'slideFill',
        className: [
          'relative isolate overflow-hidden',
          "before:content-[''] before:absolute before:inset-0 before:-z-10 before:rounded-full before:bg-primary",
          'before:-translate-x-full before:transition-transform before:duration-500 before:ease-in-out',
          'hover:before:translate-x-0 focus-visible:before:translate-x-0',
          'hover:text-primary-foreground focus-visible:text-primary-foreground',
          'motion-reduce:before:transition-none motion-reduce:transition-none',
        ].join(' '),
      },
      {
        variant: 'brandOutlineThick',
        hoverEffect: 'slideFill',
        className: [
          'relative isolate overflow-hidden',
          "before:content-[''] before:absolute before:inset-0 before:-z-10 before:rounded-full before:bg-primary",
          'before:-translate-x-full before:transition-transform before:duration-500 before:ease-in-out',
          'hover:before:translate-x-0 focus-visible:before:translate-x-0',
          'hover:text-primary-foreground focus-visible:text-primary-foreground',
          'motion-reduce:before:transition-none motion-reduce:transition-none',
        ].join(' '),
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
