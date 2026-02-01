import * as React from 'react'
import { cn } from '@/utilities/ui'
import { type VariantProps, cva } from 'class-variance-authority'

const headingVariants = cva('font-bold normal-case tracking-tight', {
  variants: {
    align: {
      left: 'text-left',
      center: 'text-center',
      right: 'text-right',
    },
    size: {
      section: 'text-size-56',
      h1: 'text-4xl md:text-5xl lg:text-6xl',
      h2: 'text-3xl md:text-4xl lg:text-5xl',
      h3: 'text-2xl md:text-3xl lg:text-4xl',
      h4: 'text-xl md:text-2xl lg:text-3xl',
      h5: 'text-lg md:text-xl lg:text-2xl',
      h6: 'text-base md:text-lg lg:text-xl',
    },
    variant: {
      default: 'text-foreground',
      muted: 'text-muted-foreground',
      primary: 'text-primary',
      white: 'text-white',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

type HeadingLevel = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'

export type HeadingProps = {
  /** Semantic HTML tag used for the heading element. */
  as?: HeadingLevel
  /** Visual size override. Defaults to the same value as `as`. */
  size?: VariantProps<typeof headingVariants>['size']
  /** Explicit alignment for clarity in code and reviews. */
  align: VariantProps<typeof headingVariants>['align']
  /** Color variant using design tokens. */
  variant?: VariantProps<typeof headingVariants>['variant']
  className?: string
  children: React.ReactNode
} & React.HTMLAttributes<HTMLHeadingElement>

export const Heading = React.forwardRef<HTMLHeadingElement, HeadingProps>(
  ({ as: Component = 'h2', size, align, variant, className, children, ...rest }, ref) => {
    return (
      <Component
        ref={ref}
        className={cn(
          headingVariants({
            size: size ?? Component,
            align,
            variant,
          }),
          className,
        )}
        {...rest}
      >
        {children}
      </Component>
    )
  },
)

Heading.displayName = 'Heading'
