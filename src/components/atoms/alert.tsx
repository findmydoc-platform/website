import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { Heading } from '@/components/atoms/Heading'
import { cn } from '@/utilities/ui'

const alertVariants = cva(
  'relative w-full rounded-lg border p-4 text-sm leading-6 [&>svg~*]:pl-8 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:top-4 [&>svg]:left-4',
  {
    variants: {
      variant: {
        default: 'border-border bg-background text-foreground [&>svg]:text-foreground',
        destructive: 'border-destructive/35 bg-destructive/8 text-secondary [&>svg]:text-destructive',
        success: 'border-accent/45 bg-accent/12 text-secondary [&>svg]:text-accent-foreground',
        warning: 'border-warning bg-warning/45 text-secondary [&>svg]:text-secondary',
        info: 'border-primary/30 bg-primary/8 text-secondary [&>svg]:text-primary',
        error: 'border-destructive/35 bg-destructive/8 text-secondary [&>svg]:text-destructive',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
))
Alert.displayName = 'Alert'

type AlertTitleProps = React.HTMLAttributes<HTMLHeadingElement> & {
  children: React.ReactNode
}

const AlertTitle = React.forwardRef<HTMLHeadingElement, AlertTitleProps>(({ className, children, ...props }, ref) => (
  <Heading
    ref={ref}
    as="h5"
    size="h5"
    align="left"
    className={cn('mb-2 leading-none font-medium tracking-tight', className)}
    {...props}
  >
    {children}
  </Heading>
))
AlertTitle.displayName = 'AlertTitle'

const AlertDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('text-sm [&_p]:leading-relaxed', className)} {...props} />
  ),
)
AlertDescription.displayName = 'AlertDescription'

export { Alert, AlertTitle, AlertDescription }
